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

    it('la franja de suggeriment té estil propi, deixa lloc a les lletres i força el CSS nou', () => {
        const css = fs.readFileSync(path.join(root, 'css', 'portada.css'), 'utf8');
        expect(html).toContain('class="follow-suggest__icon"');
        expect(css).toContain('#followPage .follow-suggest {');
        expect(css).toMatch(/#followPage \.follow-suggest \{[^}]*margin: 0 30px 20px 0;/);
        expect(css).toContain('#followPage #addYoutuberBtn.follow-suggest__button {');
        expect(html).not.toContain('css/portada.css?v=20261001-artista-1');
    });

    it('Telegram, correu i informació per a artistes són al modal de Contacte (icona @ de la capçalera)', () => {
        const header = html.slice(html.indexOf('<header class="app-header">'), html.indexOf('</header>'));
        const suggest = html.slice(html.indexOf('id="addYoutuberModal"'), html.indexOf('id="contactModal"'));
        const contact = html.slice(html.indexOf('id="contactModal"'), html.indexOf('id="supportModal"'));
        // La icona és a la capçalera, abans de la configuració
        expect(header).toContain('id="contactBtn"');
        expect(header.indexOf('id="contactBtn"')).toBeLessThan(header.indexOf('id="backgroundBtn"'));
        expect(header).toMatch(/id="contactBtn"[^>]*aria-label="Contacte"/);
        // El modal de suggeriment només porta el formulari
        expect(suggest).toContain('id="addYoutuberSubmitBtn"');
        expect(suggest).not.toContain('t.me/segueix');
        expect(suggest).not.toContain('mailto:');
        expect(suggest).not.toContain('project-credit');
        // El de contacte porta la resta (i els crèdits)
        expect(contact).toContain('https://t.me/segueix');
        expect(contact).toContain('mailto:info.segueix@gmail.com');
        expect(contact).toContain('info-youtubers.html');
        expect(contact).toContain('about-telegram-btn');
        expect(contact).toContain('project-credit');
    });

    it('el modal de contacte s’obre i es tanca com els altres (historial, clic fora, Enrere)', () => {
        const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
        expect(app).toContain("bindButtonInstant(document.getElementById('contactBtn'), openContactModal);");
        expect(app).toContain("modal: 'contact'");
        expect(app).toMatch(/contactModal\?\.classList\.contains\('active'\)\) \{\s*closeContactModal\(true\);/);
        const css = fs.readFileSync(path.join(root, 'css', 'portada.css'), 'utf8');
        expect(css).toContain(':is(#addYoutuberModal, #contactModal) .pt-contact__primary');
        expect(css).toMatch(/\.icon-btn\[data-page='segueix'\], #contactBtn, #backgroundBtn\)/);
    });
});
