import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/portada.css', 'utf8');
const portada = fs.readFileSync('js/features/portada.js', 'utf8');
const block = css.slice(css.indexOf('Inici sense rastre del disseny antic'));

describe('Inici sense rastre del disseny antic en obrir l’app', () => {
    it('#homePage arrenca amb .is-booting', () => {
        expect(html).toContain('<div class="page is-portada is-booting" id="homePage">');
    });

    it('mentre arrenca no se’n veu el contingut de mostra, només un requadre de càrrega', () => {
        expect(block).toMatch(/#homePage\.is-portada\.is-booting > \* \{[^}]*visibility: hidden;/);
        expect(block).toMatch(/#homePage\.is-portada\.is-booting::before \{[^}]*content: '';/);
    });

    it('si no es pinta, es mostra igualment al cap de 5 s', () => {
        expect(block).toMatch(/is-booting > \* \{[^}]*animation: pt-boot-reveal 0s linear 5s forwards;/);
        expect(block).toMatch(/@keyframes pt-boot-reveal \{\s*to \{\s*visibility: visible;/);
    });

    it('la primera pintada de la portada treu .is-booting', () => {
        const paint = portada.slice(
            portada.indexOf('async function paint(input)'),
            portada.indexOf('return true;', portada.indexOf('async function paint(input)'))
        );
        expect(paint).toMatch(/\$\('homePage'\)\?\.classList\.remove\('is-booting'\)/);
    });
});
