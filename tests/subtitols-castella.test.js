import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { teSubtitolsCastella, declaracio } = require('../scripts/lib/subtitols_castella.js');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const amb = description => ({ title: 'Cançó', description });

describe('cançons que ofereixen subtítols en castellà', () => {
    it.each([
        ['(Subtítulos Español / Subtitles in English) ⇩⇩⇩ LLETRA', 'Subtítulos Español'],
        [
            'Subtítols disponibles Català/Euskera/Castellà\n\nMÚSICA RÀBIA I AMOR',
            'Subtítols disponibles Català/Euskera/Castellà',
        ],
        ['► SUB CAST DISPONIBLE ► Subscriu-te al canal', 'SUB CAST'],
        [
            'Subtítols disponibles en castellà, euskera, gallec, anglès, italià, alemany i francès.',
            'Subtítols disponibles en castellà',
        ],
        ['Subtítols Alemany- Francisco\nSubtítols Castellà- Maria\nSubtítols Anglès- Jo', 'Subtítols Castellà'],
        ['Subtitles in German and Spanish avalaible.', 'Subtitles in German and Spanish'],
        ['Spanish subtitles available', 'Spanish subtitles'],
        ['Subtítulos en español disponibles', 'Subtítulos en español'],
        ['Subs: ESP / ENG', 'Subs: ESP'],
        ['Subtitulat al castellà per la Laura', 'Subtitulat al castellà'],
    ])('detecta «%s»', (description, frase) => {
        expect(teSubtitolsCastella(amb(description))).toBe(true);
        expect(declaracio(amb(description))).toBe(frase);
    });

    it('també mira el títol', () => {
        expect(teSubtitolsCastella({ title: 'Cançó (Subtítulos en español)', description: '' })).toBe(true);
        expect(teSubtitolsCastella({ title: 'Cançó [Sub. Español]', description: '' })).toBe(true);
    });

    it.each([
        'Subtítols: Ricard Soler Roger (Nu Drama).',
        'Traducció/subtítols: Mercè Pastor Costa.',
        'Activa els subtítols per veure la lletra.',
        'Subtítols disponibles en català i anglès.',
        'Gira 2022 21.05 PALMA Es Gremi 25.05 ZARAGOZA CC Delicias',
        'Subtítols Alemany- Francisco Lorenzana\nSubtítols Francès- Laetitia Georges\nSubtítols Anglès- Jo',
        'Sense subtítols en castellà',
        'Without Spanish subtitles',
        'No Spanish subtitles yet',
        'Lletra en castellà i català',
        'Els Castellers de Vilafranca',
        'Concert al Castell de Montjuïc, subscriu-te al canal',
        'Escolta-la en espanyol a Spotify',
        '',
    ])('no confon «%s»', description => {
        expect(teSubtitolsCastella(amb(description))).toBe(false);
    });

    it('una frase sola a cada banda del salt de línia no compta', () => {
        expect(teSubtitolsCastella(amb('Subtítols disponibles\nVersió en castellà del tema'))).toBe(false);
    });

    it('accepta vídeos sense camps', () => {
        expect(teSubtitolsCastella({})).toBe(false);
        expect(teSubtitolsCastella(null)).toBe(false);
        expect(teSubtitolsCastella({ title: 'x' })).toBe(false);
    });
});

describe('integració al pipeline', () => {
    it('update_music_feed.js descarta aquestes cançons en generar el feed (cada dia)', () => {
        const source = read('scripts/update_music_feed.js');
        expect(source).toContain("require('./lib/subtitols_castella')");
        expect(source).toContain('teSubtitolsCastella(videos[i])');
    });

    it('el workflow segueix el calendari vigent i valida el detector a la CI del sistema', () => {
        const updateWorkflow = read('.github/workflows/actualitzar-feed-musica.yml');
        const validationWorkflow = read('.github/workflows/validar-musica.yml');
        expect(updateWorkflow).toContain('cron: "' + require('../scripts/lib/abast_feed.js').generalSchedule() + '"');
        expect(updateWorkflow).toContain('"Validar base musical"');
        // Les proves de codi són a la PR; el torn diari valida les dades abans de consultar YouTube.
        expect(updateWorkflow).toContain('node scripts/validar_artistes_musica.js');
        expect(validationWorkflow).toContain('scripts/lib/subtitols_castella.js');
        expect(validationWorkflow).toContain('tests/subtitols-castella.test.js');
    });

    it('les cançons que ja eren al feed són a hidden-videos.json (el client les amaga de seguida)', () => {
        const hidden = new Set(JSON.parse(read('data/hidden-videos.json')).videoIds);
        for (const id of [
            'Lzh5bAoDJ4M',
            '0Q_6oFahpos',
            'ckY7cq-XZNc',
            'EnwWgoIM3Xc',
            'f7dytPY8TNQ',
            '3AZq1c3Ub6g',
            '-ISx80tGzgg',
            'znBeuIqLOP8',
            'kVbKTsaGNpo',
            'misomiLbq6s',
        ]) {
            expect(hidden.has(id), id).toBe(true);
        }
    });
});
