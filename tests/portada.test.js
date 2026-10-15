import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const DAY = 86400000;
const NOW = Date.parse('2026-09-30T12:00:00Z');

function seeded(seed = 11) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function load() {
    const app = { features: {}, state: {}, utils: {} };
    loadScript('js/features/discovery.js', { SegueixApp: app });
    loadScript('js/features/portada.js', { SegueixApp: app });
    return { discovery: app.features.discovery, portada: app.features.portada };
}
const { discovery, portada } = load();

const STYLES = [
    'Urban',
    'Pop',
    'Rock',
    'Indie',
    'Rap / Hip-hop',
    'Folk i arrel',
    "Cançó d'autor",
    'Electrònica',
    'Jazz / Blues',
];
const channels = Array.from({ length: 24 }, (_, i) => ({
    id: `C${i}`,
    name: `Artista ${i}`,
    avatar: `https://yt3.ggpht.com/a${i}=s800-c-k-c0x00ffffff-no-rj`,
    categories: [STYLES[i % STYLES.length], ...(i % 4 === 0 ? ['Pop'] : [])],
}));

let counter = 0;
const video = (channelId, daysAgo, extra = {}) => {
    counter += 1;
    return {
        id: `v${String(counter).padStart(4, '0')}`,
        title: `Cançó ${counter}`,
        channelId,
        channelTitle: `Artista ${channelId.slice(1)}`,
        thumbnail: `https://i.ytimg.com/vi/v${counter}/maxresdefault.jpg`,
        contentType: 'song',
        durationSeconds: 200,
        publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
        categories: channels.find(c => c.id === channelId).categories,
        ...extra,
    };
};

// Catàleg: 2 cançons per artista (una de recent, una d'antiga) + directes
const catalog = channels.flatMap((c, i) => [video(c.id, 2 + i), video(c.id, 200 + i * 3)]);
const lives = [0, 1, 2, 3].map(i => video(`C${i}`, 30 + i, { contentType: 'live_song' }));
const shortVideo = video('C0', 1, { isShort: true });
const all = [...catalog, ...lives, shortVideo];
const recent = all.filter(v => NOW - Date.parse(v.publishedAt) <= 90 * DAY);

const context = (extra = {}) => ({
    discovery,
    recent,
    all,
    channels,
    history: [],
    liked: [],
    followedIds: [],
    playlists: [],
    hiddenIds: new Set(),
    now: NOW,
    rng: seeded(),
    ...extra,
});

const historyOf = ids =>
    ids.flatMap((id, i) =>
        catalog
            .filter(v => v.channelId === id)
            .map(v => ({ ...v, viewedAt: new Date(NOW - i * 3600000).toISOString() }))
    );

// La destacada no es pinta com a targeta (només una caràtula del collage): no compta com a fila.
const idsOfModel = model => [
    ...(model.fresh?.videos || []).map(v => v.id),
    ...(model.radar?.items || []).map(i => i.video.id),
    ...(model.live?.videos || []).map(v => v.id),
    ...(model.lead?.kind === 'start' ? model.lead.items.map(i => i.id) : []),
];

describe('«Acabades de sortir» estable', () => {
    it('la cançó més nova hi és sempre, encara que sigui la destacada', () => {
        const newest = [...recent]
            .filter(v => v.contentType === 'song' && !v.isShort)
            .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
        const fresh = portada.buildModel(context());
        expect(fresh.fresh.videos[0].id).toBe(newest.id);
        // amb historial la destacada canvia (artista conegut), però la fila no
        const withHistory = portada.buildModel(context({ history: historyOf(['C5', 'C6']) }));
        expect(withHistory.fresh.videos.map(v => v.id)).toEqual(fresh.fresh.videos.map(v => v.id));
    });
});

describe('model de la portada sense historial (primera visita)', () => {
    const model = portada.buildModel(context());

    it('mostra «Comença per aquí» en comptes de «Torna-hi»', () => {
        expect(model.status).toBe('ready');
        expect(model.hasHistory).toBe(false);
        expect(model.lead.kind).toBe('start');
        expect(model.lead.title).toBe('Comença per aquí');
        expect(model.lead.items.length).toBeGreaterThan(0);
    });

    it('«Fora del teu radar» es diu «Per descobrir» i no inventa explicacions', () => {
        expect(model.radar.title).toBe('Per descobrir');
        expect(model.radar.personalized).toBe(false);
        expect(model.radar.items.every(item => item.reason === '')).toBe(true);
    });

    it('«Acabades de sortir» és cronològic, amb un vídeo per artista, sense Shorts ni directes', () => {
        const dates = model.fresh.videos.map(v => Date.parse(v.publishedAt));
        expect([...dates].sort((a, b) => b - a)).toEqual(dates);
        const artists = model.fresh.videos.map(v => v.channelId);
        expect(new Set(artists).size).toBe(artists.length);
        expect(model.fresh.videos.every(v => v.contentType === 'song' && !v.isShort)).toBe(true);
    });

    it('«En directe» només porta actuacions live_song', () => {
        expect(model.live.videos.length).toBeGreaterThanOrEqual(2);
        expect(model.live.videos.every(v => v.contentType === 'live_song')).toBe(true);
    });

    it('una cançó no es repeteix entre files i cap artista ocupa gairebé tota la portada', () => {
        const ids = idsOfModel(model).filter(Boolean);
        expect(new Set(ids).size).toBe(ids.length);
        const perArtist = new Map();
        const byId = new Map(all.map(v => [v.id, v]));
        ids.forEach(id => {
            const key = byId.get(id).channelId;
            perArtist.set(key, (perArtist.get(key) || 0) + 1);
        });
        expect(Math.max(...perArtist.values())).toBeLessThanOrEqual(2);
        // i la llista completa de novetats tampoc repeteix cap cançó d'altres files
        const others = new Set(ids.filter(id => !model.fresh.videos.some(v => v.id === id)));
        model.fresh.all.forEach(v => {
            if (!model.fresh.videos.some(row => row.id === v.id)) expect(others.has(v.id)).toBe(false);
        });
    });

    it('els estils són els reals del projecte, amb els accessibles primer', () => {
        const labels = model.styles.map(style => style.label);
        expect(labels.slice(0, 4)).toEqual(['Urban', 'Pop', 'Rock', "Cançó d'autor"]);
        expect(labels).toContain('Jazz / Blues');
        expect(model.styles.find(s => s.label === 'Jazz / Blues').primary).toBe(false);
    });
});

describe('model de la portada amb historial', () => {
    const history = historyOf(['C2', 'C6', 'C10', 'C14']); // Indie
    const model = portada.buildModel(context({ history }));

    it('mostra «Torna-hi» amb cançons i artistes recents', () => {
        expect(model.hasHistory).toBe(true);
        expect(model.lead.kind).toBe('return');
        expect(model.lead.title).toBe('Torna-hi');
        expect(model.lead.items.some(item => item.type === 'song')).toBe(true);
        expect(model.lead.items.some(item => item.type === 'artist')).toBe(true);
    });

    it('«Fora del teu radar» exclou els artistes escoltats i explica amb dades reals', () => {
        expect(model.radar.title).toBe('Fora del teu radar');
        const keys = model.radar.items.map(item => item.key);
        ['c2', 'c6', 'c10', 'c14'].forEach(key => expect(keys).not.toContain(key));
        const reasons = model.radar.items.map(item => item.reason).filter(Boolean);
        expect(reasons.length).toBeGreaterThan(0);
        reasons.forEach(reason => expect(reason).toMatch(/^Més .+ per descobrir$/));
    });

    it('els artistes amagats no surten enlloc', () => {
        const hidden = portada.buildModel(context({ history, hiddenIds: new Set(['C0', 'C1', 'C3']) }));
        const html = portada.renderSections(hidden, { now: NOW });
        ['C0', 'C1', 'C3'].forEach(id => expect(html).not.toContain(`data-pt-artist="${id}"`));
    });
});

describe('estat sense dades', () => {
    it('mostra un missatge en català amb opció de tornar-ho a provar', () => {
        const model = portada.buildModel(context({ recent: [], all: [] }));
        expect(model.status).toBe('empty');
        const html = portada.renderSections(model);
        expect(html).toContain('Encara no tenim música per mostrar');
        expect(html).toContain('data-pt-retry');
        expect(html).toContain('Torna-ho a provar');
    });
});

describe('HTML de les seccions', () => {
    const model = portada.buildModel(context({ history: historyOf(['C2', 'C6', 'C10']) }));
    const html = portada.renderSections(model, { now: NOW });

    it('cada targeta de vídeo permet reproduir, obrir l’artista, afegir a la cua i desar', () => {
        const card = portada.cardHtml(all[0], { now: NOW });
        expect(card).toMatch(/data-pt-play="v0001"/);
        expect(card).toMatch(/data-pt-artist="C0"/);
        expect(card).toMatch(/data-pt-queue="v0001"/);
        expect(card).toMatch(/data-pt-save="v0001"/);
        // Accions diferenciades amb noms accessibles que porten el títol
        expect(card).toContain('aria-label="Afegeix a la cua: Cançó 1"');
        expect(card).toContain('aria-label="Desa en una llista: Cançó 1"');
        expect(card).toContain('aria-label="Obre l’artista: Artista 0"');
        expect(card).toContain('aria-label="Reprodueix Cançó 1, de Artista 0"');
        // Tots són <button type="button">, accessibles amb teclat i sense dependre del cursor
        expect(card.match(/<button/g).length).toBe(card.match(/<button type="button"/g).length);
    });

    it('la miniatura conserva el format 16:9 i no s’inventen portades quadrades', () => {
        expect(html).toContain('width="320" height="180"');
        expect(html).not.toMatch(/aspect-ratio:\s*1\s*\/\s*1/);
    });

    it('la data és la de publicació del vídeo, mai «llançament»', () => {
        expect(html).toMatch(/Publicat (avui|ahir|fa )/);
        expect(html.toLowerCase()).not.toMatch(/llançament|sortit el|estrena/);
        expect(portada.publishedLabel(all[0], NOW)).toBe('Publicat fa 2 dies');
        expect(portada.publishedLabel({ publishedAt: new Date(NOW - 20 * DAY).toISOString() }, NOW)).toBe(
            'Publicat fa 3 setmanes'
        );
        expect(portada.publishedLabel({}, NOW)).toBe('');
    });

    it('«Acabades de sortir» té «Veure-ho tot» i una acció per reproduir la selecció', () => {
        expect(html).toContain('Acabades de sortir');
        expect(html).toContain('data-pt-more="fresh"');
        expect(html).toContain('Veure-ho tot');
        expect(html).toContain('data-pt-play-all="fresh"');
        const expanded = portada.renderSections(model, { now: NOW, freshExpanded: true });
        expect(expanded).toContain('Mostra’n menys');
        expect(expanded.match(/class="pt-cell"/g).length).toBeGreaterThan(html.match(/class="pt-cell"/g).length);
    });

    it('«Tria el teu so» usa els identificadors interns i porta «Tots els estils»', () => {
        expect(html).toContain('data-pt-style="Pop"');
        expect(html).toContain('data-pt-style="Rap / Hip-hop"');
        expect(html).toContain('data-pt-all-styles');
        expect(html).toContain('Tots els estils');
        // És una rajola a l’esquerra de «Crea una categoria», no un botó a part sota la graella
        expect(html).toMatch(/pt-style-cell--actions[\s\S]*data-pt-all-styles[\s\S]*data-uc-create[\s\S]*<\/li>\s*<\/ul>/);
        expect(html).not.toContain('pt-styles__toggle');
        // Els estils secundaris queden amagats fins que es demanen
        expect(html).toMatch(/pt-style-cell--extra" hidden/);
        expect(portada.renderSections(model, { now: NOW, stylesExpanded: true })).not.toMatch(
            /pt-style-cell--extra" hidden/
        );
    });

    it('«En directe» indica que són actuacions gravades, no concerts futurs', () => {
        expect(html).toContain('Actuacions gravades en directe');
        expect(html).toContain('Gravat en directe');
        expect(html.toLowerCase()).not.toMatch(/entrades|propers concerts|pròxim concert/);
    });

    it('els retrats demanen una foto petita i els textos són en català', () => {
        expect(html).toContain('=s240-c-k');
        expect(portada.avatarUrl('https://x/y=s800-c-k-c0x00ffffff-no-rj', 96)).toBe(
            'https://x/y=s96-c-k-c0x00ffffff-no-rj'
        );
        expect(portada.avatarUrl('https://x/sense-mida.jpg', 96)).toBe('https://x/sense-mida.jpg');
        expect(html).not.toMatch(/YouTubers|Els nostres/);
        expect(html).toContain('Fora del teu radar');
    });

    it('escapa el text extern', () => {
        const evil = video('C0', 3, { title: '<img src=x onerror=alert(1)> "&' });
        const card = portada.cardHtml(evil, { now: NOW });
        expect(card).not.toContain('<img src=x');
        expect(card).toContain('&lt;img src=x onerror=alert(1)&gt; &quot;&amp;');
    });
});

