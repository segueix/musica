import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const navigationSource = readFileSync(new URL('../js/features/navigation.js', import.meta.url), 'utf8');
const typographyCss = readFileSync(new URL('../css/typography-polish.css', import.meta.url), 'utf8');

describe('proposta tipogràfica conservadora', () => {
    it('carrega pesos reals de Roboto per a la jerarquia definida', () => {
        expect(navigationSource).toContain('Roboto:wght@400;500;600;700;900');
        expect(navigationSource).toContain('/css/typography-polish.css');
    });

    it('reserva 700 per títols i 500 per títols de contingut', () => {
        expect(typographyCss).toMatch(/\.page-title,[\s\S]*?font-weight:\s*700;/);
        expect(typographyCss).toMatch(/\.video-card-title,[\s\S]*?font-weight:\s*500;/);
        expect(typographyCss).toMatch(/\.video-metadata,[\s\S]*?font-weight:\s*400;/);
    });
});
