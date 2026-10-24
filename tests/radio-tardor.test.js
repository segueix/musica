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
        expect(tardor.videos.length).toBeGreaterThanOrEqual(100);
        expect(new Set(tardor.videos.map(video => video.channelId)).size).toBeGreaterThanOrEqual(80);
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
    it('sense cap grup de heavy ni de punk seguit, no en porta cap cançó', () => {
        const heavyPunk = video => ['Heavy / Metal', 'Punk'].some(style => (video.categories || []).includes(style));
        expect(tardor.videos.some(heavyPunk)).toBe(true);
        const model = season.buildModel(tardor, { filter: list => list.filter(video => !heavyPunk(video)) });
        expect(model.videos.some(heavyPunk)).toBe(false);
        expect(model.count).toBe(tardor.videos.filter(video => !heavyPunk(video)).length);
        expect(readFileSync('js/features/season-radio.js', 'utf8')).toMatch(/queue\.filterOptInStyles\(list\)/);
    });

    it('treu els artistes amagats i té de fons el dibuix de fulles, no caràtules', () => {
        const hidden = tardor.videos[0].channelId;
        const model = season.buildModel(tardor, { hiddenChannels: [hidden] });
        expect(model.videos.some(video => video.channelId === hidden)).toBe(false);
        expect(model.short).toBe('Tardor');
        const html = season.sectionHtml(model);
        expect(html).toContain('data-pt-section="season"');
        expect(html).toContain('pt-season--tardor');
        expect(html).not.toMatch(/<img|ytimg/);
        expect(html).toContain('Ràdio de tardor');
        expect(html).toContain('data-season-play="tardor"');
        expect(html).toContain(`${model.count} cançons · ${model.artists} artistes`);
        // Fulles de tardor sobre marró clar, que omplen tota la caixa (mosaic que es repeteix)
        const css = readFileSync('css/portada.css', 'utf8');
        const block = css.slice(css.indexOf('.pt-season--tardor {'));
        expect(block).toMatch(/url\('\.\.\/img\/fulles-tardor\.svg'\)/);
        expect(block).toMatch(/background-repeat: no-repeat, repeat;/);
        expect(css).toMatch(/\.pt-season \{[^}]*--season-bg: #7a5236;/);
        const svg = readFileSync('img/fulles-tardor.svg', 'utf8');
        // A5-3: aurons a l'aquarel·la, i la fulla horitzontal una mica inclinada (300°, no 270°)
        expect(svg).toMatch(/<filter id="aq"/);
        // Un «--» dins d'un comentari fa l'XML invàlid i el navegador no pinta la imatge
        for (const comment of svg.match(/<!--[\s\S]*?-->/g) || []) expect(comment.slice(4, -3)).not.toContain('--');
        expect(svg).toMatch(/rotate\(300\)/);
        expect(svg).not.toMatch(/rotate\(270\)/);
    });

    it('fa una excepció: cançons fora del límit de 21 i de les discografies «Tema», sempre filtrades', () => {
        expect(tardor.outsideCatalog?.motiu).toMatch(/Petició de l’usuari/);
        const titles = tardor.videos.map(video => `${video.channelTitle} — ${video.title}`);
        // Fora del límit de 21 per artista
        expect(titles).toContain('Obrint Pas — Novembre');
        expect(titles).toContain('Joan Manuel Serrat — Temps de Pluja');
        // Discografies «Tema»: artistes de confiança de llengua i Xesco Boix (languageOk)
        expect(titles).toContain('Clara Peya — Tardor');
        expect(titles).toContain('Xesco Boix — Plou I Fa Sol');
        expect(tardor.outsideCatalog.languageOk.map(item => item.channelId)).toEqual([XESCO_BOIX]);
        const hidden = new Set(JSON.parse(readFileSync('data/hidden-videos.json', 'utf8')).videoIds);
        expect(tardor.videos.some(video => hidden.has(video.id))).toBe(false);
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
        expect(readFileSync('css/portada.css', 'utf8')).toContain('.pt-season--tardor');
    });
});
