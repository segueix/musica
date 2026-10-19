import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

const catalog = JSON.parse(readFileSync(new URL('../data/origens-artistes.json', import.meta.url), 'utf8'));
const page = () => loadScript('js/features/artist-page.js').SegueixApp.features.artistPage;
const channelsOf = (name) =>
    Object.entries(catalog.channels)
        .filter(([, key]) => catalog.artists[key].name === name)
        .map(([id]) => id);

describe('Origen a la fitxa', () => {
    it('cada canal publicat té un origen resoluble o una exclusió explícita', () => {
        const channels = JSON.parse(readFileSync(new URL('../js/channels-ca.json', import.meta.url), 'utf8')).channels;
        const api = page();
        for (const channel of channels) {
            if (catalog.excludedProfiles?.[channel.id]) {
                expect(catalog.channels[channel.id], channel.name).toBeUndefined();
                continue;
            }
            expect(api.originModel(catalog, channel.id), channel.name + ' · ' + channel.id).not.toBeNull();
        }
    });

    it('comparteix la vinculació entre canal oficial i Topic', () => {
        const channels = channelsOf('Quimi Portet');
        expect(channels.length).toBeGreaterThan(1);
        const models = channels.map((id) => page().originModel(catalog, id));
        expect(models[0]).toEqual(models[1]);
        expect(models[0].label).toBe('Vinculat a');
        expect(models[0].places[0].name).toBe('Vic');
    });

    it('conserva les tres poblacions de Marala i no geocodifica territoris com a municipis', () => {
        const model = page().originModel(catalog, channelsOf('Marala')[0]);
        expect(model.places.map((p) => p.name)).toEqual(['Sant Cugat del Vallès', 'Palma', 'Pedreguer']);
        const cruet = page().originModel(catalog, channelsOf('Les Cruet')[0]);
        expect(cruet.places[0].type).toBe('region');
        expect(cruet.places[0].coordinates).toBeNull();
    });

    it('oculta desconeguts, propostes pendents i referències geogràfiques incompletes', () => {
        const copy = JSON.parse(JSON.stringify(catalog));
        const id = channelsOf('Peret')[0];
        const entry = copy.artists[copy.channels[id]];
        expect(page().originModel(copy, 'unknown')).toBeNull();
        entry.status = 'pending';
        expect(page().originModel(copy, id)).toBeNull();
        entry.status = 'validated';
        entry.placeIds.push('unknown');
        expect(page().originModel(copy, id)).toBeNull();
    });

    it('escapa textos i descarta fonts amb protocols executables', () => {
        const copy = JSON.parse(JSON.stringify(catalog));
        const id = channelsOf('Peret')[0];
        const entry = copy.artists[copy.channels[id]];
        entry.basis = '<img src=x onerror=alert(1)>';
        entry.sources.push('javascript:alert(1)');
        const api = page();
        const html = api.originHtml(api.originModel(copy, id));
        expect(html).toContain('&lt;img');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('javascript:');
    });

    it('mostra les fonts amb el nom del web i com a enllaç extern', () => {
        const api = page();
        expect(api.sourceName('https://www.enderrock.cat/noticia/1')).toBe('Enderrock');
        expect(api.sourceName('https://ca.wikipedia.org/wiki/Peret')).toBe('Viquipèdia');
        expect(api.sourceName('https://artista.bandcamp.com/')).toBe('Bandcamp');
        expect(api.sourceName('https://www.exemple.cat/bio')).toBe('exemple.cat');
        const html = api.originHtml({
            label: 'Origen',
            places: [{ name: 'Mataró', territory: 'Catalunya', coordinates: { latitude: 41.5, longitude: 2.4 } }],
            basis: 'Segons la biografia.',
            sources: ['https://www.enderrock.cat/a', 'https://www.enderrock.cat/b', 'https://ca.wikipedia.org/wiki/X'],
        });
        expect(html).not.toMatch(/Font \d/);
        expect(html).toContain('Enderrock (2)');
        expect(html).toContain('Viquipèdia');
        expect(html).toContain('D’on ho sabem');
        expect(html).toContain('Catalunya');
        expect(html.match(/class="ap-origin__source"[^>]*target="_blank" rel="noopener noreferrer"/g)).toHaveLength(3);
        expect(html).toContain('s’obre en una pestanya nova');
    });

    it('no pinta un artista anterior si la càrrega acaba després de canviar de fitxa', async () => {
        let finish;
        const section = { hidden: true, innerHTML: '', open: false };
        const ctx = loadScript('js/features/artist-page.js', {
            document: { getElementById: (id) => (id === 'apOrigin' ? section : null) },
            fetch: () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        });
        const api = ctx.SegueixApp.features.artistPage;
        api.showProfile({ channelId: channelsOf('Peret')[0] });
        api.showProfile({ channelId: 'unknown' });
        finish({ ok: true, json: async () => catalog });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(section.hidden).toBe(true);
        expect(section.innerHTML).toBe('');
        api.showProfile({ channelId: channelsOf('Peret')[0] });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(section.hidden).toBe(false);
        expect(section.innerHTML).toContain('<span class="ap-origin__place">Mataró</span>');
        api.showProfile({ channelId: channelsOf('Peret')[0], program: true });
        expect(section.hidden).toBe(true);
    });

    it('torna a provar després d’una fallada de xarxa', async () => {
        let calls = 0;
        const section = {};
        const ctx = loadScript('js/features/artist-page.js', {
            document: { getElementById: (id) => (id === 'apOrigin' ? section : null) },
            fetch: async () => ({ ok: ++calls > 1, json: async () => catalog }),
        });
        const api = ctx.SegueixApp.features.artistPage;
        api.showProfile({ channelId: channelsOf('Peret')[0] });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(section.hidden).toBe(true);
        api.showProfile({ channelId: channelsOf('Peret')[0] });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(section.hidden).toBe(false);
        expect(calls).toBe(2);
    });

    it('totes les assignacions publicades tenen fonts i llocs resolubles', () => {
        for (const [id] of Object.entries(catalog.channels)) {
            const model = page().originModel(catalog, id);
            expect(model).not.toBeNull();
            for (const place of model.places) {
                if (place.coordinates) {
                    expect(place.type).toBe('municipality');
                    expect(place.coordinates.latitude).toBeGreaterThan(37);
                    expect(place.coordinates.latitude).toBeLessThan(43);
                    expect(place.coordinates.longitude).toBeGreaterThan(-2);
                    if (place.geonamesId === 3183284) {
                        expect(place.territory).toBe('Sardenya');
                        expect(place.coordinates.latitude).toBeGreaterThan(40);
                        expect(place.coordinates.latitude).toBeLessThan(41);
                        expect(place.coordinates.longitude).toBeGreaterThan(8);
                        expect(place.coordinates.longitude).toBeLessThan(9);
                    } else {
                        expect(place.coordinates.longitude).toBeLessThan(5);
                    }
                }
            }
        }
    });
    it('els cinc artistes algueresos comparteixen la referència de l’Alguer', () => {
        for (const name of [
            'Lo Maquini',
            'Franca Masu',
            'Pino Piras',
            "Grup Coral de l'Agrupació Catalana d'Itàlia",
            'Antonello Colledanchise',
        ]) {
            const ids = channelsOf(name);
            expect(ids.length, name).toBeGreaterThan(0);
            for (const id of ids) {
                const model = page().originModel(catalog, id);
                expect(model.label).toBe('Origen');
                expect(model.places.map((place) => place.geonamesId)).toEqual([3183284]);
            }
        }
    });
});
