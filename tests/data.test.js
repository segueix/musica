import { describe, it, expect } from 'vitest';
import { loadScript, createMockLocalStorage } from './setup.js';

/**
 * Crea una subclasse de Date amb un "ara" fix perquè els tests de formatDate
 * siguin deterministes independentment de la zona horària o del moment d'execució.
 */
function makeFixedNowDate(nowIso) {
    const RealDate = Date;
    const fixedMs = RealDate.parse(nowIso);
    return class FixedDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) {
                super(fixedMs);
            } else {
                super(...args);
            }
        }
        static now() {
            return fixedMs;
        }
    };
}

describe('formatDate', () => {
    // "Ara" fix a les 15:00 UTC de l'11 de juliol de 2026
    const Date_ = makeFixedNowDate('2026-07-11T15:00:00Z');
    const formatDate = loadScript('js/data.js', { Date: Date_ }).formatDate;

    it("mostra les hores enrere per a vídeos del mateix dia en lloc d'\"Avui\"", () => {
        expect(formatDate('2026-07-11T12:00:00Z')).toBe('Fa 3 h');
        expect(formatDate('2026-07-11T01:00:00Z')).toBe('Fa 14 h');
    });

    it("mostra els minuts quan fa menys d'una hora", () => {
        expect(formatDate('2026-07-11T14:30:00Z')).toBe('Fa 30 min');
    });

    it("mostra \"Ara mateix\" quan fa menys d'un minut", () => {
        expect(formatDate('2026-07-11T14:59:30Z')).toBe('Ara mateix');
        expect(formatDate('2026-07-11T15:00:00Z')).toBe('Ara mateix');
    });

    it('manté "Avui" per a dates sense hora (ISO curt)', () => {
        expect(formatDate('2026-07-11')).toBe('Avui');
    });

    it('no afecta els altres trams temporals', () => {
        expect(formatDate('2026-07-10T12:00:00Z')).toBe('Ahir');
        expect(formatDate('2026-07-08T12:00:00Z')).toBe('Fa 3 dies');
    });
});

describe('deleteCustomCategoryGlobal', () => {
    it('preserva categories assignades als canals per defecte', () => {
        const localStorage = createMockLocalStorage();
        localStorage.setItem('catube_channel_custom_categories', JSON.stringify({
            a1: ['Tech', 'Altres']
        }));

        const removed = [];
        const ctx = loadScript('js/data.js', {
            localStorage,
            normalizeCustomTag: (v) => String(v || '').trim(),
            removeCustomTag: (v) => removed.push(v)
        });

        ctx.deleteCustomCategoryGlobal('Tech');

        expect(removed).toEqual(['Tech']);
        expect(JSON.parse(localStorage.getItem('catube_channel_custom_categories'))).toEqual({
            a1: ['Tech', 'Altres']
        });
    });

    it('pot esborrar assignacions si preserveChannelAssignments=false', () => {
        const localStorage = createMockLocalStorage();
        localStorage.setItem('catube_channel_custom_categories', JSON.stringify({
            a1: ['Tech', 'Altres'],
            a2: ['Tech']
        }));

        const ctx = loadScript('js/data.js', {
            localStorage,
            normalizeCustomTag: (v) => String(v || '').trim(),
            removeCustomTag: () => {}
        });

        ctx.deleteCustomCategoryGlobal('Tech', { preserveChannelAssignments: false });

        expect(JSON.parse(localStorage.getItem('catube_channel_custom_categories'))).toEqual({
            a1: ['Altres']
        });
    });
});
