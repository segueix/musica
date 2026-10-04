import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Vista d'un estil (Pop, Rock…): «Ràdio» a dalt de tot. Botons del mode de descoberta amb marc simple.
// La conducta real es comprova al navegador (clic al xip d'un estil i al botó «Ràdio»).

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('js/app.js');
const css = read('css/portada.css');

describe('vista d’un estil: ràdio a dalt de tot', () => {
    it('renderCategoryActions pinta la capçalera de ràdio per als estils (no per a Inici, Descobreix, Radar ni Seguint)', () => {
        expect(app).toContain('function renderStyleRadioHeader(category)');
        expect(app).toContain('data-style-radio="${escapeHtml(category)}"');
        const excluded = app.match(/const STYLE_RADIO_EXCLUDED_VIEWS = new Set\(\[([^\]]+)\]\)/)?.[1] || '';
        ['Novetats', 'Tot', 'Descobreix', 'Radar', 'Seguint'].forEach(view => expect(excluded).toContain(`'${view}'`));
        // El botó engega la ràdio de l'estil (la mateixa que el botó de la cerca)
        expect(app).toMatch(
            /\[data-style-radio\]'\)\?\.addEventListener\('click', \(\) => startGenreRadio\(category\)\)/
        );
    });

    it('el títol d’una altra vista treu la classe de capçalera d’estil', () => {
        expect(app).toContain(
            "pageTitle.classList.remove('page-title--with-actions', 'page-title--user-category', 'page-title--style')"
        );
    });

    it('la capçalera té estil propi i el botó va en la lletra del text', () => {
        expect(css).toContain('.page-title.page-title--style');
        expect(css).toMatch(/\.style-page__radio \{[^}]*font-family: system-ui/);
    });
});

describe('botons del mode de descoberta: marc simple, el triat canvia de color', () => {
    it('cada mode té el seu marc i ja no hi ha el marc comú del grup', () => {
        const group = selector =>
            css.match(new RegExp(`\\n${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))?.[1] || '';
        expect(group('.pt-mode__options')).not.toMatch(/border:/);
        expect(group('.mq-mode__options')).not.toMatch(/border:/);
        expect(group('.mq-mode__opt')).toMatch(/border: 1px solid/);
        expect(css).toMatch(/\.pt-mode__opt span \{[^}]*border: 1px solid/);
    });

    it('el triat canvia el color (fons i marc llima) i el sobrevolat només el marc', () => {
        expect(css).toMatch(
            /\.pt-mode__opt input:checked \+ span \{[^}]*border-color: var\(--pt-accent\)[^}]*background: var\(--pt-accent\)/
        );
        expect(css).toMatch(
            /\.mq-mode__opt\.is-active \{[^}]*border-color: var\(--pt-accent\)[^}]*background: var\(--pt-accent\)/
        );
    });
});
