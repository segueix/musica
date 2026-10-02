import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// «Urbana» passa a dir-se «Urban» i encapçala els estils: Urban, Pop, Rock, Cançó d'autor…
const require = createRequire(import.meta.url);
const music = require('../js/music-categories.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ORDER = ['Urban', 'Pop', 'Rock', "Cançó d'autor"];

describe('estil Urban', () => {
    it('és el primer estil i agrupa el gènere «Urbana» de la base d’artistes', () => {
        expect(music.CATEGORY_GROUPS.slice(0, 4).map(group => group.label)).toEqual(ORDER);
        expect(music.CATEGORY_GROUPS[0].genres).toEqual(['Urbana']);
        expect(music.CATEGORY_GROUPS.some(group => group.label === 'Urbana')).toBe(false);
    });

    it('el nom antic que encara porta el feed es tradueix a «Urban»', () => {
        expect(music.canonicalCategory('Urbana')).toBe('Urban');
        expect(music.canonicalCategory('urbana')).toBe('Urban');
        expect(music.canonicalCategory('Pop')).toBe('Pop');
        const video = music.decorateVideo({ id: 'x', title: 'Cançó', channelId: 'c', categories: ['Urbana', 'Pop'] });
        expect(video.categories).toEqual(['Urban', 'Pop']);
    });

    it('els xips d’Inici i de l’historial van en aquest ordre i ja no hi ha «Urbana»', () => {
        const home = [...html.matchAll(/<button class="chip[^"]*" data-cat="([^"]+)"/g)].map(match => match[1]);
        expect(home.slice(2, 6)).toEqual(ORDER);
        const history = [...html.matchAll(/data-history-cat="([^"]+)"/g)].map(match => match[1]);
        expect(history.slice(1, 5)).toEqual(ORDER);
        expect(html).not.toMatch(/>Urbana</);
    });

    it('les preferències desades es migren una sola vegada', () => {
        const storage = readFileSync(new URL('../js/utils/storage.js', import.meta.url), 'utf8');
        expect(storage).toContain("'catube_music_urban_v1'");
        expect(storage).toContain('localStorage.removeItem(CHIPS_ORDER_STORAGE_KEY)');
    });
});
