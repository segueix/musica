import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';

// Ordinador: el selector «Afegeix un estil» de la ràdio es tanca sol en fer scroll cap avall per veure les cançons.

const mq = loadScript('js/features/music-queue.js', {
    SegueixApp: { features: {}, state: {}, utils: {} },
    document: { readyState: 'loading', addEventListener() {} },
}).SegueixApp.features.musicQueue;
const source = readFileSync('js/features/music-queue.js', 'utf8');

const base = { queue: 0, page: 0 };

describe('selector d’estils de la ràdio: es tanca en fer scroll a l’ordinador', () => {
    it('es tanca en baixar més de 24 px dins la cua o a la pàgina', () => {
        expect(mq.shouldClosePickerOnScroll({ open: true, desktop: true, base, current: { queue: 40, page: 0 } })).toBe(
            true
        );
        expect(mq.shouldClosePickerOnScroll({ open: true, desktop: true, base, current: { queue: 0, page: 60 } })).toBe(
            true
        );
    });

    it('un scroll petit o cap amunt no el tanca', () => {
        expect(mq.shouldClosePickerOnScroll({ open: true, desktop: true, base, current: { queue: 10, page: 0 } })).toBe(
            false
        );
        expect(
            mq.shouldClosePickerOnScroll({
                open: true,
                desktop: true,
                base: { queue: 200, page: 0 },
                current: { queue: 100, page: 0 },
            })
        ).toBe(false);
    });

    it('al mòbil o amb el selector tancat no fa res', () => {
        const current = { queue: 300, page: 300 };
        expect(mq.shouldClosePickerOnScroll({ open: true, desktop: false, base, current })).toBe(false);
        expect(mq.shouldClosePickerOnScroll({ open: false, desktop: true, base, current })).toBe(false);
    });

    it('escolta l’scroll de la cua i de la pàgina, i només a l’ordinador', () => {
        expect(source).toMatch(/container\.addEventListener\('scroll', onQueueScroll/);
        expect(source).toMatch(/window\.addEventListener\?\.\('scroll', onQueueScroll/);
        expect(source).toContain("PICKER_DESKTOP_QUERY = '(min-width: 769px)'");
    });
});
