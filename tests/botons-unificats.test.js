import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Botons d'icona unificats (ràdio i sota el reproductor) i configuració només amb el color de fons.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('js/app.js');
const css = read('css/portada.css');

describe('botons unificats i configuració', () => {
    it('la configuració ja no deixa triar el color dels botons, només el fons', () => {
        expect(html).not.toContain('id="buttonColorOptions"');
        expect(html).not.toContain('<p class="setting-label">Botons</p>');
        expect(html).toContain('id="backgroundOptions"');
    });

    it('«Sempre tinc sort» només sorteja el fons i el color de botons antic es descarta', () => {
        const lucky = app.slice(app.indexOf('function applyLuckyColors'), app.indexOf('function initBackgroundPicker'));
        expect(lucky).toContain('--color-background');
        expect(lucky).not.toContain('--color-button-accent');
        const init = app.slice(app.indexOf('function initButtonColorPicker'), app.indexOf('function applyButtonColor'));
        expect(init).toContain('removeItem(BUTTON_COLOR_STORAGE_KEY)');
    });

    it('els símbols de la ràdio i els de sota el reproductor comparteixen forma i colors', () => {
        const start = css.indexOf("/* ---------- Botons d'icona unificats");
        expect(start).toBeGreaterThan(-1);
        const block = css.slice(start);
        for (const selector of ['.mq-shuffle', '.mq-share', '.mq-save-list', '.btn-round-icon', '.btn-heart'])
            expect(block).toContain(selector);
        expect(block).toContain('border-radius: 50%');
        expect(block).toContain('border-radius: var(--pt-radius-pill)');
        expect(block).toContain('background: var(--pt-surface-2)');
    });

    it('afegir un estil a la ràdio no fa servir el «+» (que és per afegir cançons a una llista)', () => {
        const queue = read('js/features/music-queue.js');
        const button = queue.match(/<button type="button" class="mq-add-style"[^\n]*<\/button>/)[0];
        expect(button).toContain('${ICONS.blend}');
        expect(button).not.toContain('${ICONS.plus}');
    });
});
