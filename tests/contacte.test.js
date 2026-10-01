import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const modal = html.slice(html.indexOf('id="addYoutuberModal"'), html.indexOf('id="supportModal"'));

describe('Contacte i suggeriment d’artistes', () => {
    it('conserva el formulari, Telegram i el correu', () => {
        expect(modal).toContain('id="addYoutuberSubmitBtn"');
        expect(modal).toContain('https://t.me/segueix');
        expect(modal).toContain('mailto:info.segueix@gmail.com');
    });

    it('ja no porta el vídeo de YouTube ni Xiuxiuejar', () => {
        expect(modal).not.toMatch(/<iframe/i);
        expect(modal.toLowerCase()).not.toContain('xiuxiuej');
        expect(html).not.toContain('Xiuxiuajar_icona');
        expect(fs.existsSync(path.join(root, 'img', 'Xiuxiuajar_icona.png'))).toBe(false);
    });

    it('el botó de la capçalera usa la icona musical i no la de persona', () => {
        const btn = html.slice(
            html.indexOf('id="addYoutuberBtn"'),
            html.indexOf('</button>', html.indexOf('id="addYoutuberBtn"'))
        );
        expect(btn).toContain('<circle cx="7" cy="17" r="3"');
        expect(btn).not.toContain('M16 21v-2');
    });
});
