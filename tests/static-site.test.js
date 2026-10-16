import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { build, siteBase } = createRequire(import.meta.url)('../scripts/generar_web_estatica.cjs');
const { validate } = createRequire(import.meta.url)('../scripts/validar_paquet_estatic.cjs');
const dirs = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const C1 = 'UCaaaa111111111111111111';
const C2 = 'UCbbbb222222222222222222';
const C3 = 'UCcccc333333333333333333';
const song = (id, extra = {}) => ({ id, channelId: C1, title: 'Cançó <nova> & "llum"', publishedAt: '2026-10-15', categories: ['Rock'], ...extra });
function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'musica-static-')); dirs.push(root);
    const put = (file, value) => { mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value)); };
    for (const file of ['sw.js', 'scripts/actualitzar_versio_sw.js', 'css/static-seo.css', 'js/static-seo.js']) {
        mkdirSync(join(root, file, '..'), { recursive: true }); cpSync(file, join(root, file));
    }
    mkdirSync(join(root, 'img')); mkdirSync(join(root, 'data/archive/channels'), { recursive: true });
    put('index.html', '<!doctype html><html><head><link rel="canonical" href="https://segueix.cat/"><link rel="stylesheet" href="css/static-seo.css"></head><body>App</body></html>');
    const channels = [{ id: C1, name: 'Grup', primary: true, type: 'official' }, { id: C2, name: 'Grup - Topic', type: 'topic' }, { id: C3, name: 'Grup' }];
    put('js/channels-ca.json', { channels });
    put('data/artistes-musica.json', { artists: [
        { name: 'Grup', active: false, youtube: { channels: channels.slice(0, 2) } },
        { name: 'Grup', youtube: { channels: [channels[2]] } },
    ] });
    put('data/feed.json', { channels: Object.fromEntries(channels.map(c => [c.id, c])), videos: [song('song0000001'), song('song0000002'), song('song0000003'), song('song0000004', { channelId: 'UCretirat' })] });
    put('data/historial-musical.json', { videos: [song('song0000005', { channelId: C2 })] });
    put('data/archive/channels/archive.json', { videos: [song('song0000006')] });
    put('data/hidden-videos.json', { videoIds: ['song0000002'] });
    put('data/music-channel-video-allowlist.json', { channels: { [C1]: { allowedVideoIds: ['song0000001', 'song0000006'] } } });
    return { root, put, out: join(root, '_site') };
}

describe('generació estàtica de Música', () => {
    it('publica feed, historial i arxiu; exclou ocults, retirats i vídeos fora de la llista permesa', () => {
        const { root, out } = fixture();
        const report = build(root);
        expect(report.songs).toBe(3);
        expect(report.artists).toBe(2); // Els homònims no es fusionen; oficial i Topic sí.
        for (const id of ['song0000001', 'song0000005', 'song0000006']) expect(existsSync(join(out, `compartir/canco/${id}.html`))).toBe(true);
        for (const id of ['song0000002', 'song0000003', 'song0000004']) expect(existsSync(join(out, `compartir/canco/${id}.html`))).toBe(false);
        expect(existsSync(join(out, 'functions'))).toBe(false);
        expect(existsSync(join(out, 'scripts'))).toBe(false);
    });

    it('genera metadades i HTML llegible sense JavaScript, amb escapament de text', () => {
        const { root, out } = fixture(); build(root);
        const html = readFileSync(join(out, 'compartir/canco/song0000001.html'), 'utf8');
        expect(html).toContain('Cançó &lt;nova&gt; &amp; &quot;llum&quot;');
        expect(html).toContain('property="og:url"');
        expect(html).toContain('name="twitter:card"');
        expect(html).toContain('VideoObject');
        expect(html).not.toContain('<iframe');
        expect(html).toContain('data-video-id="song0000001"');
        const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
        expect(schema.uploadDate).toBe('2026-10-15T00:00:00.000Z');
    });

    it.each(['https://musica.example/', 'https://example.test/cat/musica/'])('tots els canònics i sitemaps apunten a fitxers de %s', base => {
        const { root, out } = fixture(); build(root, { siteUrl: base });
        const routes = JSON.parse(readFileSync(join(out, 'data/static-routes.json')));
        expect(routes.base).toBe(new URL(base).pathname);
        for (const target of [...Object.values(routes.artists), ...Object.values(routes.videos), ...Object.values(routes.sections)]) {
            expect(existsSync(join(out, target, target.endsWith('/') ? 'index.html' : ''))).toBe(true);
        }
        for (const file of readdirSync(join(out, 'sitemaps'))) {
            const xml = readFileSync(join(out, 'sitemaps', file), 'utf8');
            for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
                expect(match[1].startsWith(base)).toBe(true);
                const relative = match[1].slice(base.length);
                expect(existsSync(join(out, relative, !relative || relative.endsWith('/') ? 'index.html' : ''))).toBe(true);
            }
        }
        const index = readFileSync(join(out, 'index.html'), 'utf8');
        expect(index).toContain(`href="${base}"`);
        expect(index).toContain('SEGUEIX_STATIC_SITE=true');
        expect(index).not.toContain('https://segueix.cat/');
        const radio = readFileSync(join(out, 'compartir/radio/index.html'), 'utf8');
        expect(radio).toContain(`href="${base}"`);
        expect(radio).not.toContain('https://segueix.github.io/musica/');
    });

    it('és reproduïble i retira pàgines que han passat a ocultes', () => {
        const { root, out, put } = fixture(); build(root);
        const previous = readFileSync(join(out, 'sw.js'), 'utf8');
        build(root);
        expect(readFileSync(join(out, 'sw.js'), 'utf8')).toBe(previous);
        put('data/hidden-videos.json', { videoIds: ['song0000001', 'song0000002'] });
        build(root);
        expect(existsSync(join(out, 'compartir/canco/song0000001.html'))).toBe(false);
    });

    it('un error de dades conserva el paquet anterior i no esborra carpetes alienes', () => {
        const { root, out, put } = fixture(); build(root);
        const original = readFileSync(join(out, 'static-build.json'), 'utf8');
        put('data/hidden-videos.json', '{');
        expect(() => build(root)).toThrow();
        expect(readFileSync(join(out, 'static-build.json'), 'utf8')).toBe(original);
        expect(() => build(root, { outDir: root })).toThrow();
        put('foreign/keep.txt', 'keep');
        expect(() => build(root, { outDir: join(root, 'foreign') })).toThrow();
        expect(readFileSync(join(root, 'foreign/keep.txt'), 'utf8')).toBe('keep');
    });

    it('rebutja dominis inadequats abans de generar', () => {
        for (const value of ['http://example.test/', 'https://user:password@example.test/', 'https://example.test/?x=1']) expect(() => siteBase(value)).toThrow();
    });
});


describe('paquet publicable', () => {
    it.each(['https://musica.example/', 'https://example.test/musica/'])('valida el mateix paquet i commit per a %s', siteUrl => {
        const { root, out } = fixture();
        const sourceCommit = 'a'.repeat(40);
        build(root, { siteUrl, sourceCommit });
        const report = validate(out, { siteUrl, sourceCommit });
        expect(report.songs).toBe(3);
        expect(report.files).toBeGreaterThan(report.pages);
        expect(report.bytes).toBeGreaterThan(0);
        expect(() => validate(out, { sourceCommit: 'b'.repeat(40) })).toThrow(/commit diferent/);
        expect(() => validate(out, { siteUrl: 'https://altre.example/' })).toThrow(/URL diferent/);
    });
    it.each(['ruta', 'asset', 'hash', 'servidor', 'sitemap', 'index', 'taxonomia', 'qr', 'lucide'])('refusa un paquet trencat: %s', defect => {
        const { root, out } = fixture(); build(root);
        if (defect === 'ruta') rmSync(join(out, 'compartir/canco/song0000001.html'));
        if (defect === 'asset') rmSync(join(out, 'css/static-seo.css'));
        if (defect === 'hash') writeFileSync(join(out, 'css/static-seo.css'), 'body { color: red; }');
        if (defect === 'servidor') mkdirSync(join(out, 'functions'));
        if (defect === 'sitemap') writeFileSync(join(out, 'sitemap.xml'), '<loc>https://altre.example/pages.xml</loc>');
        if (defect === 'index') writeFileSync(join(out, 'data/video-channels.json'), '{}');
        if (defect === 'taxonomia') rmSync(join(out, 'data/music-taxonomy.json'));
        if (defect === 'qr') rmSync(join(out, 'js/vendor/qr-code-styling.js'));
        if (defect === 'lucide') rmSync(join(out, 'js/vendor/lucide.js'));
        expect(() => validate(out)).toThrow(/Paquet estàtic:/);
    });
    it('reconstrueix rutes, HTML i índexs quan es retira una cançó', () => {
        const { root, out, put } = fixture(); build(root); validate(out);
        put('data/hidden-videos.json', { videoIds: ['song0000001', 'song0000002'] });
        build(root);
        expect(validate(out).songs).toBe(2);
        expect(existsSync(join(out, 'compartir/canco/song0000001.html'))).toBe(false);
        expect(JSON.parse(readFileSync(join(out, 'data/video-channels.json')))).not.toHaveProperty('song0000001');
    });
});


describe('optimització del paquet', () => {
    it('carrega els retocs inicials en un sol CSS i conserva els IDs que eviten reinjeccions', () => {
        const { root, out, put } = fixture();
        const files = ['styles.css', 'portada.css', 'category-chips.css', 'typography-polish.css', 'spacing-polish.css'];
        const ids = ['', '', 'categoryChipStylesheet', 'typographyPolishStylesheet', 'spacingPolishStylesheet'];
        files.forEach((file, i) => put(`css/${file}`, `.order{z-index:${i + 1}}`));
        put('index.html', '<html><head>' + files.map((file, i) => `<link ${ids[i] ? `id="${ids[i]}"` : ''} rel="stylesheet" href="css/${file}?v=1">`).join('') + '</head><body>App</body></html>');
        build(root);
        const html = readFileSync(join(out, 'index.html'), 'utf8');
        expect(html.match(/<link[^>]*rel="stylesheet"/g)).toHaveLength(1);
        expect(html).toMatch(/href="css\/initial\.css\?v=[a-f0-9]{12}"/);
        ids.filter(Boolean).forEach(id => expect(html).toContain(`id="${id}"`));
        const css = readFileSync(join(out, 'css/initial.css'), 'utf8');
        expect(css).toContain('z-index:5');
        const sw = readFileSync(join(out, 'sw.js'), 'utf8');
        expect(sw).toContain('./css/initial.css');
        expect(validate(out).songs).toBe(3);
    });
    it('precarrega el feed sense incorporar les dades al cache de codi', () => {
        const { root, out, put } = fixture();
        const index = readFileSync(join(root, 'index.html'), 'utf8');
        put('index.html', index.replace('</head>', '<link rel="preload" as="fetch" href="data/feed.json" crossorigin><link href="data/music-taxonomy.json" as="fetch" rel="preload" crossorigin></head>'));
        build(root);
        const sw = readFileSync(join(out, 'sw.js'), 'utf8');
        const assets = sw.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/)[1];
        expect(assets).not.toContain('feed.json');
        expect(assets).not.toContain('music-taxonomy.json');
        expect(assets).toContain('static-seo.css');
        expect(validate(out).songs).toBe(3);
    });
    it('distribueix les icones amb noms numèrics i les llibreries locals', () => {
        const { root, out, put } = fixture();
        put('js/icons.js', `const icons = ['share-2', 'mic-2', 'music-2', 'disc-3'];`);
        build(root);
        const ctx = { window: {} };
        createRequire(import.meta.url)('node:vm').runInNewContext(readFileSync(join(out, 'js/vendor/lucide.js'), 'utf8'), ctx);
        for (const name of ['Share2', 'Mic2', 'Music2', 'Disc3']) expect(ctx.window.lucide.icons).toHaveProperty(name);
        for (const name of ['lz-string.js', 'sortable.js', 'qr-code-styling.js', 'LICENSES.txt']) expect(existsSync(join(out, 'js/vendor', name))).toBe(true);
    });
    it('genera una taxonomia lleugera sense alterar les dades editorials', () => {
        const { root, out, put } = fixture();
        const original = JSON.parse(readFileSync(join(root, 'data/artistes-musica.json')));
        original.artists[0].biography = 'Text editorial llarg que no cal per iniciar la portada.';
        original.artists[0].aliases = ['Àlies'];
        put('data/artistes-musica.json', original);
        build(root);
        const compact = JSON.parse(readFileSync(join(out, 'data/music-taxonomy.json')));
        expect(compact.artists[0]).not.toHaveProperty('biography');
        expect(compact.artists[0].aliases).toEqual(['Àlies']);
        expect(compact.artists[0].youtube.channels).toEqual(original.artists[0].youtube.channels);
        expect(JSON.parse(readFileSync(join(out, 'data/artistes-musica.json')))).toEqual(original);
    });
});
