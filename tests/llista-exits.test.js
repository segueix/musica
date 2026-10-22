import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'node:fs';
import { loadScript } from './setup.js';

// Llista d'èxits setmanal (2026-10-22): scripts/lib/llista_exits.js (dades) i js/features/hits-chart.js (Inici).
const require = createRequire(import.meta.url);
const exits = require('../scripts/lib/llista_exits.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-30T19:30:00Z'); // divendres a Madrid
const sec = time => Math.round(time / 1000);
const BASE_AT = NOW - 7 * DAY;

const song = (id, artistId, title, extra = {}) => ({
    id,
    artistId,
    artist: `Artista ${artistId}`,
    channelId: `ch-${artistId}`,
    title,
    publishedAt: '2024-01-01T00:00:00Z',
    viewCount: 1000,
    categories: ['Pop'],
    ...extra,
});
const snapshot = (videos, at) => ({
    takenAt: new Date(at).toISOString(),
    videos: Object.fromEntries(Object.entries(videos).map(([id, value]) => [id, [value, sec(at)]])),
});

describe('llista d’èxits: dades', () => {
    it('publica la primera vegada, els divendres i, si se n’ha saltat un, als vuit dies', () => {
        expect(exits.shouldPublish({ now: NOW })).toBe(true);
        expect(exits.shouldPublish({ now: NOW, lastAt: new Date(NOW - 7 * DAY).toISOString() })).toBe(true);
        // Divendres, però la darrera fa només tres dies
        expect(exits.shouldPublish({ now: NOW, lastAt: new Date(NOW - 3 * DAY).toISOString() })).toBe(false);
        // Dijous: no toca
        expect(exits.shouldPublish({ now: NOW - DAY, lastAt: new Date(NOW - 7 * DAY).toISOString() })).toBe(false);
        expect(exits.shouldPublish({ now: NOW - DAY, lastAt: new Date(NOW - 9 * DAY).toISOString() })).toBe(true);
    });

    it('la fotografia porta l’hora real de la lectura de cada canal', () => {
        const feed = {
            generatedAt: new Date(NOW).toISOString(),
            videos: [
                { id: 'a', channelId: 'diari', viewCount: 10 },
                { id: 'b', channelId: 'setmanal', viewCount: 20 },
                { id: 'c', channelId: 'desconegut', viewCount: 30 },
                { id: 'd', channelId: 'diari' },
            ],
        };
        const polling = {
            channels: {
                diari: { lastCheckedAt: new Date(NOW - 1000).toISOString() },
                setmanal: { lastCheckedAt: new Date(NOW - 5 * DAY).toISOString() },
            },
        };
        const shot = exits.takeSnapshot(feed, polling, NOW + 5000);
        expect(shot.videos.a).toEqual([10, sec(NOW - 1000)]);
        expect(shot.videos.b).toEqual([20, sec(NOW - 5 * DAY)]);
        expect(shot.videos.c).toEqual([30, sec(NOW)]);
        expect(shot.videos.d).toBeUndefined();
        expect(shot.takenAt).toBe(new Date(NOW).toISOString());
    });

    it('porta el creixement a set dies i no inventa res sense dues lectures', () => {
        const base = [1000, sec(BASE_AT)];
        expect(exits.weeklyGrowth({ now: [1700, sec(NOW)], base }).growth).toBe(700);
        // Canal consultat fa 3,5 dies: el doble (màxim)
        expect(exits.weeklyGrowth({ now: [1100, sec(BASE_AT + 3.5 * DAY)], base }).growth).toBe(200);
        // Lectura de 14 dies: la meitat
        expect(exits.weeklyGrowth({ now: [1400, sec(BASE_AT + 14 * DAY)], base }).growth).toBe(200);
        // Sense tornar-lo a consultar: no se'n sap res
        expect(exits.weeklyGrowth({ now: [1000, sec(BASE_AT)], base })).toBeNull();
        // Les visualitzacions no baixen
        expect(exits.weeklyGrowth({ now: [900, sec(NOW)], base }).growth).toBe(0);
    });

    it('una estrena de la setmana compta totes les visualitzacions; una cançó vella que no hi era, res', () => {
        const baseTakenAt = new Date(BASE_AT).toISOString();
        expect(
            exits.weeklyGrowth({
                now: [5000, sec(NOW)],
                baseTakenAt,
                publishedAt: new Date(BASE_AT + DAY).toISOString(),
            })
        ).toEqual({ growth: 5000, isRelease: true });
        expect(
            exits.weeklyGrowth({ now: [5000, sec(NOW)], baseTakenAt, publishedAt: '2020-01-01T00:00:00Z' })
        ).toBeNull();
    });

    it('suma el videoclip i la pista del Tema d’una cançó, posa tres cançons per artista i treu la música infantil', () => {
        const songs = [
            song('clip', 'a', 'Sort de tu (Videoclip oficial)'),
            song('tema', 'a', 'Sort de tu'),
            song('a2', 'a', 'Elefants'),
            song('a3', 'a', 'La gent que estimo'),
            song('a4', 'a', 'Sense present'),
            song('b1', 'b', 'Postal barata'),
            song('kids', 'c', 'El lleó vergonyós', { categories: ['Infantil'] }),
            song('poc', 'd', 'Gairebé res'),
        ];
        const base = snapshot(
            { clip: 1000, tema: 1000, a2: 1000, a3: 1000, a4: 1000, b1: 1000, kids: 1000, poc: 1000 },
            BASE_AT
        );
        const current = snapshot(
            { clip: 6000, tema: 4000, a2: 8000, a3: 7000, a4: 6500, b1: 3000, kids: 90000, poc: 1050 },
            NOW
        );
        const { chart } = exits.buildChart({ songs, current, base, now: NOW });
        const ids = chart.entries.map(entry => entry.video.id);
        expect(ids[0]).toBe('clip'); // 5000 + 3000: el videoclip, que n'ha guanyat més, la representa
        expect(chart.entries[0].growth).toBe(8000);
        expect(ids).not.toContain('tema');
        expect(ids).not.toContain('kids');
        expect(ids).not.toContain('poc'); // +50: no arriba al mínim
        expect(ids.filter(id => ['clip', 'a2', 'a3', 'a4'].includes(id))).toHaveLength(exits.PER_ARTIST);
        expect(ids).toContain('b1');
        expect(chart.entries.map(entry => entry.rank)).toEqual(chart.entries.map((_, i) => i + 1));
        expect(chart.first).toBe(true);
        expect(chart.entries.every(entry => entry.status === 'new' && entry.weeks === 1)).toBe(true);
        expect(chart.from).toBe('2026-10-23');
        expect(chart.to).toBe('2026-10-30');
        expect(chart.entries[0].video).toMatchObject({ id: 'clip', channelTitle: 'Artista a', channelId: 'ch-a' });
    });

    it('calcula els moviments, la millor posició i les setmanes a partir de la llista anterior', () => {
        const songs = [song('x', 'x', 'X'), song('y', 'y', 'Y'), song('z', 'z', 'Z'), song('w', 'w', 'W')];
        const base = snapshot({ x: 0, y: 0, z: 0, w: 0 }, BASE_AT);
        const current = snapshot({ x: 3000, y: 2000, z: 1000, w: 500 }, NOW);
        const previous = {
            entries: [
                { key: 'y|y', rank: 1 },
                { key: 'x|x', rank: 2 },
                { key: 'z|z', rank: 3 },
            ],
        };
        const before = new Date(NOW - 7 * DAY).toISOString();
        const history = {
            'x|x': { peak: 2, weeks: 1, lastAt: before },
            'y|y': { peak: 1, weeks: 3, lastAt: before },
            'z|z': { peak: 3, weeks: 1, lastAt: before },
            'w|w': { peak: 9, weeks: 2, lastAt: new Date(NOW - 21 * DAY).toISOString() },
            'vell|vell': { peak: 1, weeks: 5, lastAt: new Date(NOW - 400 * DAY).toISOString() },
        };
        const { chart, history: next } = exits.buildChart({ songs, current, base, previous, history, now: NOW });
        const byId = Object.fromEntries(chart.entries.map(entry => [entry.video.id, entry]));
        expect(byId.x).toMatchObject({ rank: 1, previous: 2, status: 'up', peak: 1, weeks: 2 });
        expect(byId.y).toMatchObject({ rank: 2, previous: 1, status: 'down', peak: 1, weeks: 4 });
        expect(byId.z).toMatchObject({ rank: 3, previous: 3, status: 'same' });
        expect(byId.w).toMatchObject({ rank: 4, previous: null, status: 'back', peak: 4, weeks: 3 });
        expect(chart.first).toBe(false);
        expect(next['vell|vell']).toBeUndefined();
    });

    it('el fitxer publicat és vàlid, amb una entrada per línia', () => {
        const songs = [song('x', 'x', 'X'), song('y', 'y', 'Y')];
        const { chart, history } = exits.buildChart({
            songs,
            current: snapshot({ x: 3000, y: 2000 }, NOW),
            base: snapshot({ x: 0, y: 0 }, BASE_AT),
            now: NOW,
        });
        const text = exits.serializeChart(chart);
        expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(chart)));
        expect(text.split('\n').filter(line => line.includes('"rank"'))).toHaveLength(2);
        const base = JSON.parse(
            exits.serializeBase({ ...snapshot({ x: 1 }, NOW), history, chartAt: chart.generatedAt })
        );
        expect(base).toMatchObject({ version: 1, videos: { x: [1, sec(NOW)] }, chartAt: chart.generatedAt });
        expect(Object.keys(base.history)).toHaveLength(2);
    });

    it('el workflow diari la fa sense API i sense aturar la publicació del feed', () => {
        const workflow = readFileSync('.github/workflows/actualitzar-feed-musica.yml', 'utf8');
        const step = workflow.slice(workflow.indexOf("- name: Llista d'èxits setmanal"));
        expect(step).toMatch(/continue-on-error: true\s+run: node scripts\/generar_llista_exits\.js/);
        expect(workflow.indexOf("Llista d'èxits setmanal")).toBeGreaterThan(
            workflow.indexOf('node scripts/update_music_feed.js')
        );
        expect(workflow.indexOf("Llista d'èxits setmanal")).toBeLessThan(workflow.indexOf('scripts/publicar_dades.sh'));
        const script = readFileSync('scripts/generar_llista_exits.js', 'utf8');
        expect(script).not.toMatch(/YOUTUBE_API|googleapis/);
    });

    it('les dades publicades tenen el format que espera l’app', () => {
        if (!existsSync('data/llista-exits.json')) return;
        const chart = JSON.parse(readFileSync('data/llista-exits.json', 'utf8'));
        expect(chart.version).toBe(1);
        expect(chart.entries.length).toBeLessThanOrEqual(exits.CHART_SIZE);
        for (const entry of chart.entries) {
            expect(entry.video.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
            expect(entry.video.title && entry.video.channelTitle).toBeTruthy();
            expect(entry.video.categories).not.toContain('Infantil');
        }
    });
});

describe('llista d’èxits: secció d’Inici', () => {
    const chart = loadScript('js/features/hits-chart.js', { document: { addEventListener() {} } }).SegueixApp.features
        .hitsChart;
    const entry = (rank, extra = {}) => ({
        rank,
        previous: rank + 1,
        status: 'up',
        weeks: 2,
        growth: 12345,
        key: `k${rank}`,
        video: {
            id: `abcdefghij${rank % 10}`,
            title: `Cançó ${rank}`,
            channelId: `ch${rank}`,
            channelTitle: `Grup ${rank}`,
        },
        ...extra,
    });

    it('escriu el període en català', () => {
        expect(chart.periodLabel('2026-10-15', '2026-10-22')).toBe("Del 15 al 22 d'octubre");
        expect(chart.periodLabel('2026-09-29', '2026-10-06')).toBe("Del 29 de setembre al 6 d'octubre");
        expect(chart.periodLabel('2026-11-01', '2026-11-08')).toBe("De l'1 al 8 de novembre");
        expect(chart.periodLabel('2026-11-04', '2026-11-11')).toBe("Del 4 a l'11 de novembre");
        expect(chart.periodLabel('2026-03-25', '2026-04-01')).toBe("Del 25 de març a l'1 d'abril");
        expect(chart.periodLabel('', '2026-04-01')).toBe('');
    });

    it('resumeix les visualitzacions guanyades', () => {
        expect(chart.growthLabel(950)).toBe('+950');
        expect(chart.growthLabel(12345)).toBe('+12,3 k');
        expect(chart.growthLabel(91656)).toBe('+91,7 k');
        expect(chart.growthLabel(150400)).toBe('+150 k');
        expect(chart.growthLabel(1234567)).toBe('+1,2 M');
        expect(chart.growthLabel(2000)).toBe('+2 k');
    });

    it('mostra els moviments, però no a la primera edició', () => {
        expect(chart.movement(entry(3, { previous: 5, status: 'up' }), false)).toMatchObject({
            kind: 'up',
            text: '2',
            label: 'Puja 2 llocs',
        });
        expect(chart.movement(entry(3, { previous: 2, status: 'down' }), false)).toMatchObject({
            kind: 'down',
            label: 'Baixa 1 lloc',
        });
        expect(chart.movement(entry(3, { status: 'new' }), false)).toMatchObject({ kind: 'new', text: 'Nova' });
        expect(chart.movement(entry(3, { status: 'back' }), false)).toMatchObject({ kind: 'back', text: 'Torna' });
        expect(chart.movement(entry(3, { status: 'same', previous: 3 }), false)).toMatchObject({ kind: 'same' });
        expect(chart.movement(entry(3), true)).toBeNull();
    });

    it('treu els artistes amagats i pinta deu cançons, amb «Mostra les 40»', () => {
        const data = {
            from: '2026-10-15',
            to: '2026-10-22',
            entries: Array.from({ length: 40 }, (_, i) => entry(i + 1)),
        };
        const model = chart.buildModel(data, { hiddenChannels: ['ch2'] });
        expect(model.entries).toHaveLength(39);
        expect(model.entries.some(item => item.video.channelId === 'ch2')).toBe(false);
        const html = chart.sectionHtml(model);
        expect(html).toContain('data-pt-section="chart"');
        expect(html).toContain("Llista d'èxits");
        expect(html).toContain('Setmana del 15 al 22 d&#39;octubre');
        expect((html.match(/data-hc-play="/g) || []).length).toBe(10);
        expect(html).toContain('Mostra les 39');
        expect(html).toContain('data-hc-play-all');
        expect(html).toContain('+12,3 k');
        expect(html).toContain('Puja 1 lloc');
        const open = chart.sectionHtml(model, { expanded: true });
        expect((open.match(/data-hc-play="/g) || []).length).toBe(39);
        expect(open).toContain('--hc-rows: 20');
        expect(chart.buildModel({ entries: [] })).toBeNull();
    });

    it('escapa els títols i fa servir la caràtula de YouTube', () => {
        const model = chart.buildModel({
            from: '2026-10-15',
            to: '2026-10-22',
            first: true,
            entries: [
                entry(1, { video: { id: 'cyQz_HDm-Is', title: '<b>Sort</b> & tu', channelTitle: 'Oques "Grasses"' } }),
            ],
        });
        const html = chart.sectionHtml(model);
        expect(html).not.toContain('<b>Sort</b>');
        expect(html).toContain('&lt;b&gt;Sort&lt;/b&gt; &amp; tu');
        expect(html).toContain('https://i.ytimg.com/vi/cyQz_HDm-Is/mqdefault.jpg');
        expect(html).not.toContain('hc-move');
    });

    it('sense dades encara, la portada hi deixa un espai amagat', () => {
        expect(chart.cardHtml()).toContain('hidden');
    });

    it('va a Inici just després d’«Acabades de sortir» i es carrega abans de la portada', () => {
        const portada = readFileSync('js/features/portada.js', 'utf8');
        const fresh = portada.indexOf('freshHtml(model.fresh');
        const hits = portada.indexOf('hitsChart?.cardHtml');
        expect(hits).toBeGreaterThan(fresh);
        expect(hits).toBeLessThan(portada.indexOf('radarHtml(model.radar)'));
        const index = readFileSync('index.html', 'utf8');
        expect(index.indexOf('js/features/hits-chart.js')).toBeGreaterThan(0);
        expect(index.indexOf('js/features/hits-chart.js')).toBeLessThan(index.indexOf('js/features/portada.js'));
        expect(readFileSync('css/portada.css', 'utf8')).toContain("Llista d'èxits setmanal");
    });
});
