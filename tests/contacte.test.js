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

    it('posa el suggeriment a la part superior d’Artistes i grups, fora de la capçalera', () => {
        const header = html.slice(html.indexOf('<header class="app-header">'), html.indexOf('</header>'));
        const followPage = html.slice(html.indexOf('id="followPage"'), html.indexOf('id="short-modal"'));
        const btnStart = followPage.indexOf('id="addYoutuberBtn"');
        const tabsStart = followPage.indexOf('id="followTabs"');
        const btn = followPage.slice(btnStart, followPage.indexOf('</button>', btnStart));

        expect(header).not.toContain('id="addYoutuberBtn"');
        expect(followPage).toContain('id="followPageTitle">Artistes i grups');
        expect(btnStart).toBeGreaterThanOrEqual(0);
        expect(btnStart).toBeLessThan(tabsStart);
        expect(btn).toContain('Suggereix un artista o grup');
        expect(btn).toContain('<circle cx="7" cy="17" r="3"');
    });
});
