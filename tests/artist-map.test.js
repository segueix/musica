import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const feature = loadScript('js/features/artist-map.js', {
    SegueixApp: { features: {}, utils: {}, state: {} },
}).SegueixApp.features.artistMap;
const base = JSON.parse(readFileSync('data/mapa-base.json', 'utf8'));
const realCatalog = JSON.parse(readFileSync('data/origens-artistes.json', 'utf8'));
const realReferences = JSON.parse(readFileSync('data/proximitat-musical.json', 'utf8'));
const css = readFileSync('css/portada.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const app = readFileSync('js/app.js', 'utf8');

const catalog = {
    places: {
        vic: { name: 'Vic', territory: 'Catalunya', coordinates: { latitude: 41.93, longitude: 2.254 } },
        alguer: { name: "l'Alguer", territory: "l'Alguer", coordinates: { latitude: 40.558, longitude: 8.319 } },
        madrid: { name: 'Madrid', territory: 'Espanya', coordinates: { latitude: 40.4, longitude: -3.7 } },
        osona: { name: 'Plana de Vic', territory: 'Catalunya', type: 'region' },
    },
    artists: {
        'artist:a': { name: 'A', status: 'validated', placeIds: ['vic'] },
        'artist:b': { name: 'B', status: 'validated', placeIds: ['vic', 'alguer'] },
        'artist:c': { name: 'C', status: 'validated', placeIds: ['madrid'] },
        'artist:d': { name: 'D', status: 'validated', placeIds: ['osona'] },
        'artist:e': { name: 'E', status: 'pending', placeIds: ['vic'] },
        'artist:f': { name: 'F', status: 'validated', placeIds: ['vic'] },
        'artist:g': { name: 'Sense grup', status: 'validated', placeIds: ['vic'] },
    },
    channels: {
        ca: 'artist:a',
        cb: 'artist:b',
        cc: 'artist:c',
        cd: 'artist:d',
        ce: 'artist:e',
        cf: 'artist:f',
        cg: 'artist:g',
    },
};
const references = { references: { osona: { placeIds: ['vic'] } } };
const groups = [
    { id: 'ca', name: 'Antònia', categories: ['Pop'], channelIds: ['ca'] },
    { id: 'cb', name: 'Bernat', categories: ['Rock'], channelIds: ['cb'] },
    { id: 'cc', name: 'Carme', categories: ['Pop'], channelIds: ['cc'] },
    { id: 'cd', name: 'Dídac', categories: ['Folk i arrel'], channelIds: ['cd'] },
    { id: 'ce', name: 'Pendent', categories: ['Pop'], channelIds: ['ce'] },
    { id: 'cf', name: 'Amagat', categories: ['Pop'], channelIds: ['cf'] },
];

describe('Música d’arreu: mapa dels artistes', () => {
    it('projecta les coordenades al mapa principal, al requadre de l’Alguer o fora', () => {
        const barcelona = feature.project(base, { latitude: 41.387, longitude: 2.17 });
        expect(barcelona.frame).toBe('main');
        expect(barcelona.x).toBeGreaterThan(0);
        expect(barcelona.x).toBeLessThan(base.viewBox[2]);
        expect(feature.project(base, { latitude: 40.558, longitude: 8.319 }).frame).toBe('inset');
        expect(feature.project(base, { latitude: 40.4, longitude: -3.7 })).toBeNull();
        expect(feature.project(base, { latitude: 'x', longitude: 2 })).toBeNull();
    });

    it('posa cada artista validat de l’app al seu lloc, i els de fora a part', () => {
        const model = feature.buildModel({ base, catalog, references, groups, hiddenIds: ['cf'] });
        const vic = model.points.find(p => p.id === 'vic');
        expect(vic.artists.map(a => a.name)).toEqual(['Antònia', 'Bernat']);
        expect(model.points.find(p => p.id === 'alguer').frame).toBe('inset');
        // Comarca → capital de referència, aproximada
        const osona = model.points.find(p => p.id === 'osona');
        expect(osona.approximate).toBe(true);
        expect(osona.reference).toBe('Vic');
        expect(model.outside).toEqual([
            { territory: 'Espanya', artists: [expect.objectContaining({ name: 'Carme' })] },
        ]);
        // Pendent, sense grup a l'app i amagat: no hi surten
        expect(model.artistCount).toBe(4);
    });

    it('un grup nou surt sol en arribar (sense regenerar el mapa)', () => {
        const before = feature.buildModel({ base, catalog, references, groups });
        const catalog2 = {
            ...catalog,
            artists: { ...catalog.artists, 'artist:g': { ...catalog.artists['artist:g'] } },
        };
        const after = feature.buildModel({
            base,
            catalog: catalog2,
            references,
            groups: [...groups, { id: 'cg', name: 'Grup nou', categories: ['Rock'], channelIds: ['cg'] }],
        });
        expect(after.artistCount).toBe(before.artistCount + 1);
        expect(after.points.find(p => p.id === 'vic').artists.some(a => a.name === 'Grup nou')).toBe(true);
    });

    it('filtra per estil i compta els estils', () => {
        const model = feature.buildModel({ base, catalog, references, groups, style: 'Rock' });
        expect(model.points.flatMap(p => p.artists.map(a => a.name))).toEqual(['Bernat', 'Bernat']);
        expect(model.styles.find(s => s.name === 'Pop').count).toBe(3);
    });

    it('amb les dades reals, la majoria d’artistes validats amb canal hi són', () => {
        const groupsReal = Object.keys(realCatalog.channels).map(id => ({
            id,
            name: id,
            categories: [],
            channelIds: [id],
        }));
        const model = feature.buildModel({
            base,
            catalog: realCatalog,
            references: realReferences,
            groups: groupsReal,
        });
        expect(model.artistCount).toBeGreaterThan(300);
        expect(model.points.length).toBeGreaterThan(100);
        model.points.forEach(point => {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(base.viewBox[2]);
            expect(point.y).toBeLessThanOrEqual(base.viewBox[3]);
        });
    });

    it('pinta el mapa, el panell i escapa els noms', () => {
        const model = feature.buildModel({
            base,
            catalog,
            references,
            groups: groups.map(g => (g.id === 'ca' ? { ...g, name: '<b>Antònia</b>' } : g)),
        });
        const out = feature.html(base, model, { selectedId: 'vic' });
        expect(out).toContain('class="am-svg"');
        expect(out).toContain('data-am-radio="vic"');
        expect(out).toContain('&lt;b&gt;Antònia&lt;/b&gt;');
        expect(out).not.toContain('<b>Antònia</b>');
        expect(out).toContain('Des de fora');
        expect(feature.panelHtml(null)).toContain('Toca un punt');
        expect(feature.radiusOf(4)).toBeGreaterThan(feature.radiusOf(1));
    });

    it('és a Descobreix, després dels artistes de la categoria', () => {
        expect(html.indexOf('id="artistMap"')).toBeGreaterThan(html.indexOf('id="categoryArtists"'));
        expect(html.indexOf('js/features/artist-map.js')).toBeLessThan(html.indexOf('js/app.js'));
        expect(app).toMatch(
            /const discover = selectedCategory === 'Descobreix';[\s\S]*?if \(discover\) feature\.show\(container\)/
        );
        expect(css).toContain('.am-dot .am-mark');
    });

    it('dibuixar una zona: troba els llocs de dins i els artistes sense repetir', () => {
        const square = [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
        ];
        expect(feature.pointInPolygon([5, 5], square)).toBe(true);
        expect(feature.pointInPolygon([15, 5], square)).toBe(false);
        const model = feature.buildModel({ base, catalog, references, groups });
        const vic = model.points.find(p => p.id === 'vic');
        const around = [
            [vic.x - 20, vic.y - 20],
            [vic.x + 20, vic.y - 20],
            [vic.x + 20, vic.y + 20],
            [vic.x - 20, vic.y + 20],
        ];
        const zone = feature.zoneModel(model.points, around);
        // Vic i la comarca (aproximada a Vic) queden dins; Bernat només un cop
        expect(zone.places.map(p => p.id).sort()).toEqual(['osona', 'vic']);
        expect(zone.artists.map(a => a.name)).toEqual(['Amagat', 'Antònia', 'Bernat', 'Dídac']);
        expect(zone.channelIds.sort()).toEqual(['ca', 'cb', 'cd', 'cf']);
        expect(zone.name).toMatch(/i voltants$/);
        expect(feature.zoneModel(model.points, [[0, 0]])).toBeNull();
        const html = feature.zonePanelHtml(zone);
        expect(html).toContain('data-am-zone-play');
        // Esborrar és la goma de sobre el mapa, no un botó del lateral
        expect(html).not.toContain('Esborra la zona');
        const withZone = feature.html(base, model, { zone });
        expect(withZone).toMatch(/data-am-clear[^>]*aria-label="Esborra la selecció"/);
        expect(withZone).not.toMatch(/data-am-clear[^>]*hidden/);
        expect(feature.html(base, model)).toMatch(/data-am-clear[^>]*hidden/);
        expect(html).toContain('Zona dibuixada');
        expect(html).not.toContain('La teva zona');
    });

    it('dibuixar una zona només mostra els seus artistes: la ràdio comença amb «Escolta la zona»', () => {
        const source = readFileSync('js/features/artist-map.js', 'utf8');
        const finish = source.slice(
            source.indexOf('        finish() {'),
            source.indexOf('    // ---------- Esdeveniments')
        );
        expect(finish).toContain('showZone(zone);');
        expect(finish).not.toContain('startZoneRadio');
        expect(source).toMatch(/\[data-am-zone-play\]'\)\) return state\.zone && startZoneRadio\(state\.zone\)/);
    });

    it('la ràdio d’una zona agafa les cançons més escoltades de cada artista', () => {
        const videos = [
            { id: '1', channelId: 'ca', viewCount: 10 },
            { id: '2', channelId: 'ca', viewCount: 300 },
            { id: '3', channelId: 'ca', viewCount: 50 },
            { id: '4', channelId: 'cb', viewCount: 5 },
            { id: '5', channelId: 'zz', viewCount: 999 },
            { id: '2', channelId: 'ca', viewCount: 300 },
        ];
        expect(feature.zoneSongs(videos, ['ca', 'cb'], 2).map(v => v.id)).toEqual(['2', '3', '4']);
    });

    it('zoom i desplaçament: el punt de sota el dit no es mou i no se surt del mapa', () => {
        const box = base.viewBox;
        const rect = { left: 0, top: 0, width: 500, height: 500 * (box[3] / box[2]) };
        const view = [...box];
        const point = feature.clientToSvg(view, rect, 200, 300);
        const zoomed = feature.viewKeeping(point, rect, 200, 300, box[2] / 2, box);
        const again = feature.clientToSvg(zoomed, rect, 200, 300);
        expect(again[0]).toBeCloseTo(point[0], 6);
        expect(again[1]).toBeCloseTo(point[1], 6);
        expect(feature.clampView([-500, -500, box[2] / 2], box).slice(0, 2)).toEqual([0, 0]);
        expect(feature.clampView([0, 0, box[2] * 3], box)[2]).toBe(box[2]);
        expect(feature.clampView([0, 0, 1], box)[2]).toBeCloseTo(box[2] / 6, 6);
    });

    it('té pantalla completa, mode dibuix i gestos de dos dits', () => {
        const out = feature.html(base, feature.buildModel({ base, catalog, references, groups }));
        expect(out).toContain('data-am-full');
        expect(out).toContain('data-am-draw');
        expect(out).toContain('class="am-lasso"');
        expect(css).toMatch(/\.artist-map\.is-full \{[^}]*position: fixed/);
        expect(css).toMatch(/\.artist-map\.is-drawing \.am-svg \{[^}]*touch-action: none/);
    });

    it('es presenta com «Les nostres terres, els nostres músics», no com els Països Catalans', () => {
        const out = feature.html(base, feature.buildModel({ base, catalog, references, groups }));
        expect(out).toContain('Les nostres terres, els nostres músics');
        expect(out).not.toContain('Països Catalans');
    });

    it('en obrir un artista des del mapa, «enrere» hi torna', () => {
        expect(typeof feature.restoreReturn).toBe('function');
        const src = readFileSync('js/features/artist-map.js', 'utf8');
        expect(src).toMatch(/rememberReturn\(\{ push: true \}\);\s*if \(typeof openChannelProfile/);
        expect(src).toMatch(/mapReturn: true/);
        expect(app).toMatch(/history\.state\?\.mapReturn && SegueixApp\.state\.mapReturn[\s\S]{0,40}history\.back\(\)/);
        expect(app).toMatch(/if \(discover\) SegueixApp\.features\.artistMap\?\.restoreReturn\?\.\(\)/);
    });

    it('no té el botó «mapa sencer» (la fletxa en dues direccions): el «−» ja hi torna', () => {
        const out = feature.html(base, feature.buildModel({ base, catalog, references, groups }));
        expect(out).not.toContain('data-am-zoom="0"');
        expect(out).not.toContain('⤢');
        expect(out).toContain('data-am-zoom="-1"');
    });
});

describe('«Música d’arreu»: de sortida, els artistes de la teva zona', () => {
    const artist = (id, name) => ({ artistId: id, name, channelId: `UC${id}` });
    const points = [
        {
            id: 'girona',
            name: 'Girona',
            coordinates: { latitude: 41.98, longitude: 2.82 },
            artists: [artist('c', 'Cc')],
        },
        {
            id: 'vic',
            name: 'Vic',
            coordinates: { latitude: 41.93, longitude: 2.254 },
            artists: [artist('a', 'Aa'), artist('b', 'Bb')],
        },
        {
            id: 'manlleu',
            name: 'Manlleu',
            coordinates: { latitude: 42.0, longitude: 2.28 },
            artists: [artist('a', 'Aa'), artist('d', 'Dd')],
        },
    ];
    const vic = { name: 'Vic', territory: 'Catalunya', coordinates: { latitude: 41.93, longitude: 2.254 } };

    it('ordena per distància a la zona desada, sense repetir cap artista', () => {
        const home = feature.homeModel(points, vic);
        expect(home.name).toBe('Vic');
        expect(home.artists.map(a => a.artistId)).toEqual(['a', 'b', 'd', 'c']);
        expect(home.artists[0].place).toBe('Vic · < 1 km');
        expect(home.artists[2].place).toMatch(/^Manlleu · \d+ km$/);
        expect(feature.homeModel(points, vic, 2).artists).toHaveLength(2);
    });

    it('sense zona desada no hi ha res i el panell torna a l’ajuda', () => {
        expect(feature.homeModel(points, null)).toBe(null);
        expect(feature.homeModel(points, { name: 'X', coordinates: {} })).toBe(null);
        expect(feature.panelHtml(null, null)).toContain('Toca un punt');
    });

    it('el panell sense cap lloc triat mostra la zona amb la seva ràdio; un lloc triat mana', () => {
        const home = feature.homeModel(points, vic);
        const out = feature.panelHtml(null, home);
        expect(out).toContain('La teva zona');
        expect(out).toContain('A prop de Vic');
        expect(out).toContain('data-am-home-radio');
        expect(out).toContain('data-am-artist="UCb"');
        expect(feature.panelHtml(points[0], home)).toContain('data-am-radio="girona"');
        expect(feature.panelHtml(points[0], home)).not.toContain('La teva zona');
    });

    it('la zona surt de nearbyRadio.savedPlace() i es refà en tornar a Descobreix', () => {
        const source = readFileSync('js/features/artist-map.js', 'utf8');
        expect(source).toMatch(/app\.features\.nearbyRadio\?\.savedPlace\?\.\(\)/);
        expect(source).toMatch(/container\.querySelector\('\.am-svg'\)\) return refreshHome\(\);/);
        expect(readFileSync('js/features/nearby-radio.js', 'utf8')).toMatch(/nearbyRadio = \{ savedPlace,/);
    });
});

describe('mapa: «Dibuixa una zona» a dalt a l’esquerra (2026-10-17)', () => {
    const src = readFileSync('js/features/artist-map.js', 'utf8');
    const portadaCss = readFileSync('css/portada.css', 'utf8');

    it('el botó de dibuixar i la goma van a un grup a l’esquerra; la pantalla completa, a la dreta', () => {
        const start = src.indexOf('<div class="am-tools am-tools--start">');
        const right = src.indexOf('<div class="am-tools">', start);
        expect(start).toBeGreaterThan(-1);
        expect(src.indexOf('data-am-draw', start)).toBeLessThan(right);
        expect(src.indexOf('data-am-clear', start)).toBeLessThan(right);
        expect(src.indexOf('data-am-full', right)).toBeGreaterThan(right);
    });

    it('a l’esquerra, més gran i amb lluïssor blanca', () => {
        const block = portadaCss.slice(portadaCss.indexOf("Mapa: «Dibuixa una zona» a dalt a l'esquerra"));
        expect(block).toMatch(/\.am-tools--start \{\s*right: auto;\s*left: 10px;/);
        expect(block).toMatch(
            /\.am-tool--draw \{[^}]*min-height: 48px;[^}]*border: 1\.5px solid rgba\(255, 255, 255, 0\.85\);/
        );
        expect(block).toMatch(/@keyframes am-draw-glow/);
        // al mòbil, més petit (36 px) amb l'àrea de toc de 44 px
        expect(block).toMatch(/@media \(max-width: 768px\) \{[\s\S]*?\.am-tool--draw \{[^}]*min-height: 36px;/);
        expect(block).toMatch(/\.am-tool--draw::before \{[^}]*inset: -4px;/);
        expect(block).toMatch(/prefers-reduced-motion: no-preference/);
    });
});
