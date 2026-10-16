import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadScript } from './setup.js';

const css = fs.readFileSync('css/portada.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const app = { features: {}, state: {}, utils: {} };
loadScript('js/features/discovery.js', { SegueixApp: app });
loadScript('js/features/portada.js', { SegueixApp: app });
const portada = app.features.portada;

const video = (id, extra = {}) => ({
    id,
    title: `Cançó ${id}`,
    channelId: `c${id}`,
    channelTitle: `Artista ${id}`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    ...extra,
});

describe('entrada de la portada: «Continua escoltant» i «La teva ràdio»', () => {
    const entry = html.slice(
        html.indexOf('id="portadaEntry"'),
        html.indexOf('</section>', html.indexOf('id="portadaEntry"'))
    );

    it('té dues targetes diferenciades: continuar (pintada pel JS) i la ràdio nova', () => {
        expect(entry).toContain('id="ptFeature"');
        expect(entry).toContain('id="ptRadio"');
        expect(entry.indexOf('id="ptFeature"')).toBeLessThan(entry.indexOf('id="ptRadio"'));
        expect(entry).toContain('id="ptRadioArt"');
        expect(entry).toContain('id="ptRadioLead"');
        expect(entry).toContain('id="ptPlayBtn"');
        expect(entry).toContain('name="ptMode"');
    });

    it('ja no té el títol gran ni la targeta «Novetat» que competien amb el botó', () => {
        expect(entry).not.toContain('pt-entry__title');
        expect(entry).not.toContain('Avui, què et ve de gust?');
        expect(entry).not.toContain('ptResumeBtn');
    });

    it('el collage i el fons de caràtules tenen CSS propi i el text queda sobre un degradat', () => {
        expect(css).toMatch(/\.pt-radio__covers\s*{[^}]*z-index:\s*1/);
        expect(css).toMatch(/\.pt-radio__art::after\s*{[^}]*linear-gradient/);
        expect(css).toMatch(/\.pt-feature::after\s*{[^}]*linear-gradient/);
        expect(css).toMatch(/\.pt-feature__bg\s*{[^}]*blur\(/);
    });

    it('les opcions del selector mantenen mides tàctils de 44 px i el botó de la ràdio ocupa l’amplada a mòbil', () => {
        expect(css).toMatch(/\.pt-mode__opt span\s*{[^}]*min-height:\s*44px/);
        expect(css).toMatch(/\.pt-entry__cta \.pt-btn\s*{[^}]*width:\s*100%/);
    });

    it('les eines d’una secció que baixen de fila s’alineen a l’esquerra amb prou especificitat', () => {
        expect(css).toMatch(/\.pt-head \.pt-head__tools\s*{[^}]*margin-left:\s*0/);
    });
});

describe('targeta «Continua escoltant»', () => {
    it('quan sona alguna cosa diu «Ara sona», porta la caràtula i accions de continuar i pausar', () => {
        const markup = portada.continueHtml(
            { id: 'a1', video: video('a1'), playing: true, next: video('b2'), isRadio: true, title: 'Cançó a1' },
            null
        );
        expect(markup).toContain('pt-feature--now');
        expect(markup).toContain('Ara sona');
        expect(markup).toContain("--pt-art: url('");
        expect(markup).toContain('Artista a1');
        expect(markup).toContain('data-pt-continue');
        expect(markup).toContain('data-pt-toggle');
        expect(markup).toContain('A continuació');
        expect(markup).not.toContain('data-pt-resume');
    });

    it('si no sona res però hi ha una ràdio recent, ofereix continuar-la (mai sona sola)', () => {
        const markup = portada.continueHtml(null, { video: video('z9'), title: 'Mou-te' });
        expect(markup).toContain('pt-feature--resume');
        expect(markup).toContain('Continua escoltant');
        expect(markup).toContain('id="ptResumeBtn"');
        expect(markup).toContain('data-pt-resume');
        expect(markup).toContain('Mou-te');
        expect(markup).not.toContain('data-pt-toggle');
    });

    it('sense res a continuar no pinta res i escapa els títols', () => {
        expect(portada.continueHtml(null, null)).toBe('');
        const markup = portada.continueHtml(null, {
            video: video('x', { channelTitle: '<b>x</b>' }),
            title: '<script>',
        });
        expect(markup).not.toContain('<script>');
        expect(markup).not.toContain('<b>x</b>');
    });

    it('només accepta URL de caràtula segures al fons CSS', () => {
        const markup = portada.continueHtml(null, {
            video: video('x', { thumbnail: "javascript:alert('x')" }),
            title: 'T',
        });
        expect(markup).not.toContain('--pt-art');
    });
});

describe('collage de «La teva ràdio»', () => {
    it('agafa fins a tres caràtules d’artistes diferents i salta les que no en tenen', () => {
        const list = [
            video('1'),
            video('2', { thumbnail: '' }),
            video('3', { channelId: 'c1' }),
            video('4'),
            video('5'),
            video('6'),
        ];
        const covers = portada.radioCovers(list);
        expect(covers.map(v => v.id)).toEqual(['1', '4', '5']);
        expect(portada.radioCovers([])).toEqual([]);
        expect(portada.radioCovers(null)).toEqual([]);
    });
});

describe('«La teva ràdio»: de què està feta i primera vegada', () => {
    const entry = html.slice(
        html.indexOf('id="portadaEntry"'),
        html.indexOf('</section>', html.indexOf('id="portadaEntry"'))
    );
    const taste = {
        hasAny: true,
        windowDays: 7,
        plays: 14,
        liked: 5,
        followed: 3,
        artistKeys: new Set(['a', 'b', 'c']),
    };

    it('té el selector inicial visible i reserva el botó de canviar estils per als usuaris que ja els han triat', () => {
        expect(entry).toMatch(/id="ptFirst">/);
        expect(entry).toContain('data-pt-first-style="Rock"');
        expect(entry).toContain('id="ptFirstChips"');
        expect(entry).toContain('Només t’ho demanem aquesta primera vegada');
        expect(entry).toMatch(/id="ptFirstReset"[^>]*hidden/);
        expect(css).toMatch(/\.pt-chip\s*{[^}]*min-height:\s*44px/);
    });

    it('amb gust recent el text diu de què està feta, no que comenci de zero', () => {
        const first = portada.firstTimeState(taste);
        expect(first).toMatchObject({ chooser: false, savedOnly: false });
        const lead = portada.radioLead(taste, first, false);
        expect(lead).toContain('Feta amb el que has escoltat aquesta setmana (14 cançons)');
        expect(lead).toContain('m’agrades (5)');
        expect(lead).toContain('artistes que segueixes (3)');
        expect(lead).not.toMatch(/sense parar|zero|nova, amb el mode/);
        expect(portada.radioLead(taste, first, true)).toMatch(/^Una ràdio nova\. Feta amb/);
    });

    it('la primera vegada (sense res) es demanen els estils', () => {
        const first = portada.firstTimeState({ hasAny: false, artistKeys: new Set() });
        expect(first.chooser).toBe(true);
        expect(portada.radioLead({ hasAny: false }, first, false)).toBe('Tria fins a tres estils per començar.');
    });

    it('amb estils ja triats i poc més, no es tornen a demanar i s’explica què fa la ràdio', () => {
        app.features.discovery.setFirstStyles(['Pop', 'Rock']);
        const first = portada.firstTimeState({ hasAny: false, artistKeys: new Set() });
        expect(first).toMatchObject({ chooser: false, savedOnly: true });
        expect(portada.radioLead({ hasAny: false }, first, false)).toBe(
            'Feta amb els estils que vas triar: Pop, Rock. S’adaptarà al que escoltis.'
        );
        // Amb prou artistes coneguts ja no mana l'elecció
        expect(portada.firstTimeState(taste).savedOnly).toBe(false);
        app.features.discovery.setFirstStyles([]);
    });
});
