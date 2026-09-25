import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../css/category-chips.css', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../js/features/navigation.js', import.meta.url), 'utf8');

describe('contracte visual dels chips de categories', () => {
    it('reserva el blanc per a la categoria activa', () => {
        expect(css).toContain('.home-categories .chip.is-active:not(.chip-info):not(.chip-add)');
        expect(css).toContain('background: #ffffff !important;');
        expect(css).toContain('color: #0f0f0f !important;');
    });

    it('manté hover i active dins la família del color accent', () => {
        expect(css).toContain('color-mix(in srgb, var(--color-button-accent) 88%, white)');
        expect(css).toContain('color-mix(in srgb, var(--color-button-accent) 82%, white)');
    });

    it('defineix focus-visible per teclat', () => {
        expect(css).toContain('.home-categories .chip:focus-visible');
        expect(css).toContain('outline-offset: 3px;');
    });

    it('carrega el full específic des del mòdul de navegació', () => {
        expect(navigation).toContain("link.href = '/css/category-chips.css';");
    });
});
