import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// La ràdio amb el llenguatge de caràtules (2026-10-16): capçalera amb la caràtula de la cançó que sona de fons, nom
// de la ràdio en blanc, eines i modes de vidre, caràtules quadrades amb marc blanc a la cua.
const css = fs.readFileSync('css/portada.css', 'utf8');
const queue = fs.readFileSync('js/features/music-queue.js', 'utf8');
const block = css.slice(css.indexOf('/* ---------- Ràdio amb el llenguatge de caràtules (2026-10-16)'));

describe('ràdio amb el llenguatge de caràtules', () => {
    it('la caràtula de la cançó que sona fa de fons de la capçalera', () => {
        expect(queue).toMatch(/style="--mq-art: url\('\$\{escapeText\(art\)\}'\)"/);
        expect(block).toMatch(/\.mq-head::before \{[^}]*background: var\(--mq-art\) center \/ cover no-repeat;/);
    });

    it('el nom de la ràdio és el títol (sense «Selecció:») i les eines i els modes són de vidre', () => {
        expect(queue).not.toContain('Selecció: ${');
        expect(block).toMatch(/body \.mq \.mq-head \.mq-style \{[^}]*color: #fff;[^}]*font-size: 1\.375rem;/);
        expect(block).toMatch(/\.mq-open-ytm\) \{[^}]*border: 1px solid rgba\(255, 255, 255, 0\.6\);/);
        expect(block).toMatch(/body \.mq \.mq-head \.mq-mode__opt\.is-active \{[^}]*background: var\(--pt-accent\);/);
    });

    it('a la cua, caràtules quadrades amb el marc blanc (la que sona, més gran)', () => {
        expect(block).toMatch(
            /body \.mq \.mq-cover \{[^}]*border: 2px solid #fff;[^}]*border-radius: var\(--pt-radius-cover\);/
        );
        expect(block).toMatch(/body \.mq \.mq-item\.is-active \.mq-cover \{[^}]*width: 72px;/);
    });
});
