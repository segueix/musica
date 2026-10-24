import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

// Ràdio de tardor (2026-10-24): data/radios-temporada.json (selecció manual + vídeos de
// scripts/generar_radios_temporada.js) i js/features/season-radio.js (targeta d'Inici).
const data = JSON.parse(readFileSync('data/radios-temporada.json', 'utf8'));
const season = loadScript('js/features/season-radio.js', { document: { addEventListener() {} } }).SegueixApp.features
    .seasonRadio;
const tardor = data.radios.find(radio => radio.id === 'tardor');
const XESCO_BOIX = 'UC5DkIn4ZKBgGKqvpa0JyZlg';
const madrid = (date, hour = 12) => Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00+02:00`);

describe('ràdio de tardor: dades', () => {
    it('té prou cançons i artistes perquè no es repeteixi', () => {
        expect(tardor.name).toBe('Ràdio de tardor');
        expect(tardor.videos.length).toBeGreaterThanOrEqual(50);
        expect(new Set(tardor.videos.map(video => video.channelId)).size).toBeGreaterThanOrEqual(40);
        // Cada cançó triada té les seves dades, sense repetir-ne cap
        expect(tardor.videos.map(video => video.id)).toEqual(tardor.songs.map(song => song.id));
        expect(new Set(tardor.songs.map(song => song.id)).size).toBe(tardor.songs.length);
    });

    it('porta la Castanyada, Tots Sants i Xesco Boix, però no la música infantil', () => {
        const titles = tardor.videos.map(video => video.title).join(' | ');
        expect(titles).toMatch(/castanyes/i);
        expect(titles).toMatch(/Moniatos/);
        expect(titles).toMatch(/Tots Sants/);
        expect(tardor.videos.some(video => video.channelId === XESCO_BOIX)).toBe(true);
        const infantil = tardor.videos.filter(video => (video.categories || []).includes('Infantil'));
        expect(infantil.every(video => video.channelId === XESCO_BOIX)).toBe(true);
        expect(titles).not.toMatch(/Panellets i castanyes|Plou i fa sol \[Mainasons\]/);
    });

    it('surt del 23 de setembre al 30 de novembre', () => {
        expect(season.inSeason(tardor, madrid('2026-10-24'))).toBe(true);
        expect(season.inSeason(tardor, madrid('2026-09-23', 1))).toBe(true);
        expect(season.inSeason(tardor, madrid('2026-11-30', 23))).toBe(true);
        expect(season.inSeason(tardor, madrid('2026-12-01', 1))).toBe(false);
        expect(season.inSeason(tardor, madrid('2026-09-20'))).toBe(false);
        // Un període que passa de l'any (Nadal)
        const nadal = { from: '12-01', to: '01-06' };
        expect(season.inSeason(nadal, madrid('2026-12-24'))).toBe(true);
        expect(season.inSeason(nadal, madrid('2027-01-05'))).toBe(true);
        expect(season.inSeason(nadal, madrid('2026-10-24'))).toBe(false);
        expect(season.activeRadio(data, madrid('2026-10-24'))?.id).toBe('tardor');
        expect(season.activeRadio(data, madrid('2026-07-01'))).toBeUndefined();
    });
});

describe('ràdio de tardor: targeta d’Inici', () => {
    it('treu els artistes amagats i fa el fons amb quatre caràtules d’artistes diferents', () => {
        const hidden = tardor.videos[0].channelId;
        const model = season.buildModel(tardor, { hiddenChannels: [hidden] });
        expect(model.videos.some(video => video.channelId === hidden)).toBe(false);
        expect(model.covers).toHaveLength(4);
        expect(new Set(model.covers).size).toBe(4);
        expect(model.short).toBe('Tardor');
        const html = season.sectionHtml(model);
        expect(html).toContain('data-pt-section="season"');
        expect(html).toContain('Ràdio de tardor');
        expect(html).toContain('data-season-play="tardor"');
        expect(html).toContain(`${model.count} cançons · ${model.artists} artistes`);
    });

    it('va a Inici al davant d’«Acabades de sortir» i engega una ràdio tancada amb el seu nom', () => {
        const portada = readFileSync('js/features/portada.js', 'utf8');
        expect(portada.indexOf('seasonRadio?.cardHtml')).toBeGreaterThan(0);
        expect(portada.indexOf('seasonRadio?.cardHtml')).toBeLessThan(portada.indexOf('freshHtml(model.fresh'));
        const source = readFileSync('js/features/season-radio.js', 'utf8');
        expect(source).toMatch(
            /startCategoryRadio\(resolveVideos\(model\.videos\), \{ name: model\.short, title: model\.name \}\)/
        );
        expect(readFileSync('js/features/music-queue.js', 'utf8')).toMatch(
            /const title = String\(options\.title \|\| ''\)\.trim\(\) \|\| `Ràdio \$\{name\}`;/
        );
        const index = readFileSync('index.html', 'utf8');
        expect(index.indexOf('js/features/season-radio.js')).toBeGreaterThan(
            index.indexOf('js/features/music-queue.js')
        );
        expect(index.indexOf('js/features/season-radio.js')).toBeLessThan(index.indexOf('js/features/portada.js'));
        expect(readFileSync('sw.js', 'utf8')).toContain("'./js/features/season-radio.js'");
        expect(readFileSync('css/portada.css', 'utf8')).toContain('.pt-season__covers');
    });
});
