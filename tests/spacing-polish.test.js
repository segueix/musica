import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const navigationSource = readFileSync(new URL('../js/features/navigation.js', import.meta.url), 'utf8');
const spacingCss = readFileSync(new URL('../css/spacing-polish.css', import.meta.url), 'utf8');

describe('ritme d’espaiat conservador', () => {
    it('defineix una escala comuna de 4/8/12/16/24/32 px', () => {
        for (const value of ['4px', '8px', '12px', '16px', '24px', '32px']) {
            expect(spacingCss).toContain(value);
        }
    });

    it('aplica l’escala als espais principals sense tocar mides de controls', () => {
        expect(spacingCss).toMatch(/\.chips-bar\s*\{[\s\S]*?gap:\s*var\(--space-2\)/);
        expect(spacingCss).toMatch(/\.hero\s*\{[\s\S]*?padding:\s*var\(--space-5\)/);
        expect(spacingCss).toMatch(/\.archive-video-card\s*\{[\s\S]*?gap:\s*var\(--space-3\)/);
        expect(spacingCss).toMatch(/\.videos-grid,[\s\S]*?gap:\s*var\(--space-3\)/);
    });

    it('carrega el full d’espaiat des de la capa de navegació', () => {
        expect(navigationSource).toContain('/css/spacing-polish.css');
    });
});
