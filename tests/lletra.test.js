import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Lletra de l'app (2026-10-16): Archivo (pal sec) per al text i els títols, adaptada a l'estètica de caràtules amb
// text en blanc; Fraunces només per a la marca «Segueix! Música».
const html = fs.readFileSync('index.html', 'utf8');
const styles = fs.readFileSync('css/styles.css', 'utf8');
const portada = fs.readFileSync('css/portada.css', 'utf8');
const navigation = fs.readFileSync('js/features/navigation.js', 'utf8');

describe('lletra', () => {
    it('es carrega Archivo (i Fraunces per a la marca), no Roboto', () => {
        expect(html).toMatch(
            /fonts\.googleapis\.com\/css2\?family=Archivo:wght@400;500;600;700;800;900&amp;family=Fraunces/
        );
        expect(html).not.toMatch(/family=Roboto/);
        expect(navigation).toContain('family=Archivo:wght@400;500;600;700;800;900');
    });

    it('el text i els títols fan servir Archivo; la marca, Fraunces', () => {
        expect(styles).toMatch(/body \{\s*font-family: 'Archivo'/);
        expect(portada).toMatch(/--pt-display: 'Archivo'/);
        expect(portada).toMatch(/--pt-brand: 'Fraunces'/);
        const brand = portada.slice(
            portada.indexOf('.brand-music {'),
            portada.indexOf('}', portada.indexOf('.brand-music {'))
        );
        expect(brand).toContain('font-family: var(--pt-brand);');
    });
});
