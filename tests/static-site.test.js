import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { build, siteBase } = createRequire(import.meta.url)('../scripts/generar_web_estatica.cjs');
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
