import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// El middleware de Cloudflare Pages fa servir HTMLRewriter, que només existeix a
// workerd. El substituïm per un doble mínim que recull les meta que s'injecten, de
// manera que puguem verificar QUINES etiquetes es generen per a cada tipus d'enllaç.
class FakeHTMLRewriter {
    constructor() {
        this.injected = {};
        this.documentTitle = null;
    }

    on(selector, handlers) {
        if (selector === 'head' && handlers.element) {
            handlers.element({
                prepend: html => {
                    const match = html.match(/(?:property|name)="([^"]+)" content="([^"]*)"/);
                    if (match) this.injected[match[1]] = match[2];
                },
            });
        }
        if (selector === 'title' && handlers.element) {
            handlers.element({
                setInnerContent: value => {
                    this.documentTitle = value;
                },
            });
        }
        return this;
    }

    transform(response) {
        response.__meta = this.injected;
        response.__title = this.documentTitle;
        return response;
    }
}

const ROOT = resolve(import.meta.dirname, '..');

// Doble d'i.ytimg.com + oEmbed: `sizes` diu quines mides existeixen per al vídeo.
function stubYoutube({ sizes = ['maxresdefault.jpg', 'sddefault.jpg', 'hqdefault.jpg'], oembed = null } = {}) {
    vi.stubGlobal('fetch', async (input, init) => {
        const target = typeof input === 'string' ? input : input.url;
        if (target.includes('/oembed')) {
            return oembed ? Response.json(oembed) : new Response('not found', { status: 404 });
        }
        if (target.includes('i.ytimg.com')) {
            const file = target.split('/').pop();
            const exists = sizes.includes(file);
            return new Response(null, { status: exists ? 200 : 404 });
        }
        return new Response('not found', { status: 404 });
    });
}
const FEED = {
    channels: { UC_test: { name: 'Canal de prova', avatar: 'https://example.test/avatar.jpg' } },
    videos: [
        {
            id: 'AlFeedVideo1',
            title: 'Vídeo del feed',
            description: 'Descripció del vídeo del feed',
            thumbnail: 'https://i.ytimg.com/vi/AlFeedVideo1/maxresdefault.jpg',
            channelId: 'UC_test',
        },
    ],
};

// Índex de cerca i arxiu simulats: així es pot comprovar que un vídeo que ja no és al
// feed recupera títol, descripció i caràtula reals.
const MANIFEST = { buckets: [{ file: 'search_index_2026_05.json' }, { file: 'search_index_2006.json' }] };
const INDEX_BUCKETS = {
    'search_index_2026_05.json': [{ i: '6Z-reIuixg0', t: 'Can Nyero (I)', c: 'UC_arxiu' }],
    'search_index_2006.json': [{ i: 'SWOIknoKHAo', t: 'Vídeo del 2006', c: 'UC_arxiu' }],
};
const ARXIU = {
    UC_arxiu: {
        channelId: 'UC_arxiu',
        videos: [
            {
                id: '6Z-reIuixg0',
                title: 'Can Nyero (I) - Segueix.cat [CAT]',
                description: 'Si us agrada el canal,   deixeu propina!\nhttps://exemple.test/join',
                thumbnail: 'https://i.ytimg.com/vi/6Z-reIuixg0/maxresdefault.jpg',
                channelId: 'UC_arxiu',
                channelTitle: 'Aleix Galvany',
            },
            {
                id: 'SWOIknoKHAo',
                title: 'Vídeo del 2006',
                description: '',
                thumbnail: 'https://i.ytimg.com/vi/SWOIknoKHAo/hqdefault.jpg',
                channelId: 'UC_arxiu',
                channelTitle: 'Canal antic',
            },
        ],
    },
};

function buildContext(url, { feedOk = true, ambArxiu = true } = {}) {
    const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
    return {
        request: new Request(url),
        next: async () =>
            new Response('<html><head><title>Segueix!</title></head><body></body></html>', {
                headers: { 'content-type': 'text/html; charset=utf-8' },
            }),
        env: {
            ASSETS: {
                fetch: async (req) => {
                    const ruta = new URL(req.url).pathname;
                    if (ruta === '/data/feed.json') {
                        return feedOk ? json(FEED) : new Response('not found', { status: 404 });
                    }
                    if (!ambArxiu) return new Response('not found', { status: 404 });
                    if (ruta === '/data/search_index_manifest.json') return json(MANIFEST);
                    const bucket = ruta.replace('/data/', '');
                    if (INDEX_BUCKETS[bucket]) return json(INDEX_BUCKETS[bucket]);
                    const canal = ruta.replace('/data/archive/channels/', '').replace('.json', '');
                    if (ARXIU[canal]) return json(ARXIU[canal]);
                    return new Response('not found', { status: 404 });
                },
            },
        },
    };
}

let onRequest;

beforeEach(async () => {
    vi.stubGlobal('HTMLRewriter', FakeHTMLRewriter);
    // Import dinàmic després d'instal·lar el global; cache-bust per si es reimporta.
    const source = readFileSync(resolve(ROOT, 'functions/_middleware.js'), 'utf-8');
    const module = await import(
        /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    );
    onRequest = module.onRequest;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('middleware de compartició', () => {
    it('injecta les meta del vídeo quan és al feed', async () => {
        stubYoutube();
        const res = await onRequest(buildContext('https://segueix.cat/?v=AlFeedVideo1'));
        expect(res.__meta['og:title']).toBe('Vídeo del feed - Segueix.cat');
        expect(res.__meta['og:url']).toBe('https://segueix.cat/?v=AlFeedVideo1');
        expect(res.__meta['og:image']).toBe('https://i.ytimg.com/vi/AlFeedVideo1/maxresdefault.jpg');
        expect(res.__title).toBe('Vídeo del feed - Segueix.cat');
    });

    it("usa l'oEmbed de YouTube per als vídeos d'arxiu (fora del feed)", async () => {
        stubYoutube({ oembed: { title: "Vídeo d'arxiu", author_name: 'Canal antic' } });

        const res = await onRequest(buildContext('https://segueix.cat/?v=CE0dp0bSxCM'));
        expect(res.__meta['og:title']).toBe("Vídeo d'arxiu - Segueix.cat");
        expect(res.__meta['og:description']).toContain('Canal antic');
        // El punt clau del bug: l'og:url mai pot apuntar a la portada.
        expect(res.__meta['og:url']).toBe('https://segueix.cat/?v=CE0dp0bSxCM');
    });

    it("agafa títol, descripció i caràtula reals de l'arxiu per als vídeos de l'historial", async () => {
        stubYoutube({ oembed: { title: 'NO HAURIA DE SORTIR', author_name: 'Ningú' } });

        const res = await onRequest(buildContext('https://segueix.cat/?v=6Z-reIuixg0'));
        expect(res.__meta['og:title']).toBe('Can Nyero (I) - Segueix.cat [CAT]');
        // La descripció real del vídeo, normalitzada en una línia.
        expect(res.__meta['og:description']).toBe('Si us agrada el canal, deixeu propina! https://exemple.test/join');
        expect(res.__meta['og:image']).toBe('https://i.ytimg.com/vi/6Z-reIuixg0/maxresdefault.jpg');
        expect(res.__meta['og:image:width']).toBe('1280');
    });

    it("recorre al canal quan el vídeo d'arxiu no té descripció", async () => {
        stubYoutube({ sizes: ['hqdefault.jpg'] });

        const res = await onRequest(buildContext('https://segueix.cat/?v=SWOIknoKHAo'));
        expect(res.__meta['og:title']).toBe('Vídeo del 2006 - Segueix.cat');
        expect(res.__meta['og:description']).toBe("Vídeo de Canal antic · Mira'l a Segueix.cat");
        // L'arxiu diu que la millor mida és hqdefault: no cal comprovar-ne cap altra.
        expect(res.__meta['og:image']).toBe('https://i.ytimg.com/vi/SWOIknoKHAo/hqdefault.jpg');
        expect(res.__meta['og:image:width']).toBe('480');
    });

    it("no es queda amb la caràtula pobra de l'oEmbed quan el vídeo no és ni a l'arxiu", async () => {
        stubYoutube({
            oembed: {
                title: 'Vídeo sense indexar - Segueix.cat [CAT]',
                author_name: 'Aleix Galvany',
                // L'oEmbed sempre retorna hqdefault (480x360, amb bandes negres).
                thumbnail_url: 'https://i.ytimg.com/vi/CE0dp0bSxCM/hqdefault.jpg',
                thumbnail_width: 480,
                thumbnail_height: 360,
            },
        });

        const res = await onRequest(buildContext('https://segueix.cat/?v=CE0dp0bSxCM'));
        expect(res.__meta['og:image']).toBe('https://i.ytimg.com/vi/CE0dp0bSxCM/maxresdefault.jpg');
        expect(res.__meta['og:image:width']).toBe('1280');
        expect(res.__meta['og:image:height']).toBe('720');
        // No duplica el sufix i apostrofa el nom del canal.
        expect(res.__meta['og:title']).toBe('Vídeo sense indexar - Segueix.cat [CAT]');
        expect(res.__meta['og:description']).toContain("d'Aleix Galvany");
    });

    it('baixa de mida quan el vídeo antic no té maxresdefault', async () => {
        stubYoutube({ sizes: ['hqdefault.jpg'], oembed: { title: 'Vídeo del 2006' } });

        const res = await onRequest(buildContext('https://segueix.cat/?v=SWOIknoKHAo'));
        expect(res.__meta['og:image']).toBe('https://i.ytimg.com/vi/SWOIknoKHAo/hqdefault.jpg');
        expect(res.__meta['og:image:width']).toBe('480');
        expect(res.__meta['og:image:height']).toBe('360');
    });

    it('tria sddefault quan hi és però maxresdefault no', async () => {
        stubYoutube({ sizes: ['sddefault.jpg', 'hqdefault.jpg'], oembed: { title: 'Vídeo mitjà' } });

        const res = await onRequest(buildContext('https://segueix.cat/?v=CE0dp0bSxCM'));
        expect(res.__meta['og:image']).toBe('https://i.ytimg.com/vi/CE0dp0bSxCM/sddefault.jpg');
        expect(res.__meta['og:image:width']).toBe('640');
    });

    it("manté l'og:url del vídeo encara que l'oEmbed falli", async () => {
        stubYoutube({ sizes: ['hqdefault.jpg'] });

        const res = await onRequest(buildContext('https://segueix.cat/?v=CE0dp0bSxCM'));
        expect(res.__meta['og:url']).toBe('https://segueix.cat/?v=CE0dp0bSxCM');
        expect(res.__meta['og:image']).toBe('https://i.ytimg.com/vi/CE0dp0bSxCM/hqdefault.jpg');
        expect(res.__meta['og:type']).toBe('video.other');
    });

    it("manté l'og:url del vídeo encara que el feed no es pugui llegir", async () => {
        stubYoutube({ sizes: [] });

        const res = await onRequest(buildContext('https://segueix.cat/?v=AlFeedVideo1', { feedOk: false }));
        expect(res.__meta['og:url']).toBe('https://segueix.cat/?v=AlFeedVideo1');
    });

    it('no toca les meta de la portada (ni llegeix el feed) sense paràmetres', async () => {
        const context = buildContext('https://segueix.cat/');
        const assetsFetch = vi.fn(context.env.ASSETS.fetch);
        context.env.ASSETS.fetch = assetsFetch;

        const res = await onRequest(context);
        expect(res.__meta).toBeUndefined();
        expect(assetsFetch).not.toHaveBeenCalled();
    });

    it('injecta les meta del canal compartit', async () => {
        const res = await onRequest(buildContext('https://segueix.cat/?channel=UC_test#segueix'));
        expect(res.__meta['og:title']).toBe('Canal: Canal de prova - Segueix.cat');
        expect(res.__meta['og:image']).toBe('https://example.test/avatar.jpg');
    });

    it('escapa el contingut que arriba per la query', async () => {
        const res = await onRequest(
            buildContext('https://segueix.cat/?program=p1&channel=UC_test&programName=%3Cscript%3Ex')
        );
        expect(res.__meta['og:title']).toContain('&lt;script&gt;');
        expect(res.__meta['og:title']).not.toContain('<script>');
    });
});
