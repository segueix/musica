import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

const catalog = JSON.parse(readFileSync('data/origens-artistes.json', 'utf8'));
const page = () => loadScript('js/features/artist-page.js').SegueixApp.features.artistPage;
const verified = url => ({ url, status: 'verified', checkedOn: '2026-10-19', sources: [url] });
const fixture = links => ({
    schemaVersion: 1,
    channels: { official: 'artist:a', topic: 'artist:a', other: 'artist:b' },
    artists: { 'artist:a': { officialLinks: links }, 'artist:b': { sources: ['https://example.org/'] } },
});

describe('web oficial o Facebook de l’artista', () => {
    it('prioritza la web i comparteix el destí amb el canal Tema', () => {
        const data = fixture({ website: verified('https://example.org/'), facebook: verified('https://www.facebook.com/artista/') });
        const api = page();
        expect(api.officialLinkModel(data, 'official')).toEqual({ kind: 'website', label: 'Web oficial', url: 'https://example.org/' });
        expect(api.officialLinkModel(data, 'topic')).toEqual(api.officialLinkModel(data, 'official'));
    });

    it('mostra Facebook si la web és pendent; mai converteix les fonts d’origen en webs oficials', () => {
        const data = fixture({ website: { ...verified('https://example.org/'), status: 'pending' }, facebook: verified('https://www.facebook.com/artista/') });
        const api = page();
        expect(api.officialLinkModel(data, 'official').label).toBe('Facebook');
        expect(api.officialLinkModel(data, 'other')).toBeNull();
        expect(api.officialLinkModel(data, 'unknown')).toBeNull();
        data.artists['artist:a'].officialLinks.facebook.status = 'rejected';
        expect(api.officialLinkModel(data, 'official')).toBeNull();
    });

    it('descarta URLs executables, credencials, ports, falsos Facebook i enllaços de compartir', () => {
        const api = page();
        for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//example.org', 'https://user:pass@example.org/', 'https://example.org:8443/']) {
            expect(api.officialLinkModel(fixture({ website: verified(url) }), 'official'), url).toBeNull();
        }
        for (const url of ['https://facebook.com.evil.example/artista', 'https://www.facebook.com/sharer.php?u=x', 'https://www.facebook.com/artista/posts/123', 'https://www.facebook.com/login/', 'https://www.facebook.com/artista/?next=x']) {
            expect(api.officialLinkModel(fixture({ facebook: verified(url) }), 'official'), url).toBeNull();
        }
        expect(api.officialLinkModel(fixture({ website: { url: 'https://example.org/', status: 'verified' } }), 'official')).toBeNull();
    });

    it('treu l’enllaç anterior de seguida i ignora una resposta tardana; una sola descàrrega compartida', async () => {
        let finish;
        let requests = 0;
        const attrs = {};
        const link = { hidden: true, innerHTML: '', setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; if (k === 'href') delete link.href; } };
        const ctx = loadScript('js/features/artist-page.js', {
            document: { getElementById: id => id === 'apOfficialBtn' ? link : null },
            fetch: () => { requests++; return new Promise(resolve => { finish = resolve; }); },
        });
        const api = ctx.SegueixApp.features.artistPage;
        api.showProfile({ channelId: 'official', name: 'Artista A' });
        api.showProfile({ channelId: 'other', name: 'Artista B' });
        finish({ ok: true, json: async () => fixture({ website: verified('https://example.org/') }) });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(link.hidden).toBe(true);
        expect(link.href).toBeUndefined();
        api.showProfile({ channelId: 'topic', name: 'Artista A' });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(link.hidden).toBe(false);
        expect(link.href).toBe('https://example.org/');
        expect(attrs['aria-label']).toContain('Artista A');
        expect(requests).toBe(1);
        api.showProfile({ channelId: 'other' });
        expect(link.hidden).toBe(true);
        expect(link.href).toBeUndefined();
        expect(link.innerHTML).toBe('');
        api.showProfile({ channelId: 'official', program: true });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(link.hidden).toBe(true);
    });

    it('els enllaços tenen evidència i data; tots els canals assignats resolen el mateix destí', () => {
        const api = page();
        for (const [key, artist] of Object.entries(catalog.artists)) {
            if (!artist.officialLinks) continue;
            const channels = Object.entries(catalog.channels).filter(([, artistKey]) => artistKey === key);
            // Alguns artistes encara no tenen canal indexat: l'enllaç queda preparat, sense donar-los d'alta.
            const direct = api.officialLinkModel({ ...catalog, channels: { reviewed: key } }, 'reviewed');
            expect(direct, artist.name).not.toBeNull();
            const models = channels.map(([id]) => api.officialLinkModel(catalog, id));
            for (const model of models) expect(model).toEqual(direct);
            for (const entry of Object.values(artist.officialLinks)) {
                expect(entry.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(entry.sources.length).toBeGreaterThan(0);
                expect(entry.basis.length).toBeGreaterThan(15);
            }
        }
        expect(catalog.artists['artist:mainasons'].officialLinks).toBeUndefined();
    });
});
