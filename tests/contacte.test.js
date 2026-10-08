import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const modal = html.slice(html.indexOf('id="contactModal"'), html.indexOf('id="supportModal"'));
const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');

describe('Contacte i suggeriment d’artistes', () => {
    it('conserva Telegram i el correu al modal de contacte', () => {
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
        const btn = followPage.slice(btnStart, followPage.indexOf('</a>', btnStart));

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
        const contact = html.slice(html.indexOf('id="contactModal"'), html.indexOf('id="supportModal"'));
        // La icona és a la capçalera, abans de la configuració
        expect(header).toContain('id="contactBtn"');
        expect(header.indexOf('id="contactBtn"')).toBeLessThan(header.indexOf('id="backgroundBtn"'));
        expect(header).toMatch(/id="contactBtn"[^>]*aria-label="Contacte"/);
        // El suggeriment ja no té modal: la franja d'Artistes i grups no porta ni Telegram ni el correu
        const strip = html.slice(html.indexOf('class="follow-suggest"'), html.indexOf('id="followTabs"'));
        expect(strip).not.toContain('t.me/segueix');
        expect(strip).not.toContain('mailto:');
        expect(html).not.toContain('id="addYoutuberModal"');
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
        expect(css).toContain('#contactModal .pt-contact {');
        expect(css).toMatch(/\.icon-btn\[data-page='segueix'\], #contactBtn, #backgroundBtn\)/);
    });

    it('«Suggereix un artista o grup» és un enllaç directe al formulari de Google (sense modal intermedi)', () => {
        const url = config.match(/suggestYoutuberUrl:\s*"([^"]+)"/)?.[1];
        expect(url).toMatch(/^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform/);
        const link = html.match(/<a class="follow-suggest__button" id="addYoutuberBtn"[^>]*>/)?.[0] || '';
        // L'HTML porta la mateixa URL que la configuració i s'obre en una pestanya nova
        expect(link).toContain(`href="${url}"`);
        expect(link).toContain('target="_blank"');
        expect(link).toContain('rel="noopener noreferrer"');
        const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
        expect(app).toContain('initSuggestFormLink();');
        expect(app).toContain('if (formUrl) link.href = formUrl;');
        expect(app).not.toMatch(/openAddYoutuberModal|submitYoutuber|addYoutuberModal/);
        // La franja no porta cap nota «Abans de suggerir…» ni fonts d'indexació (eren de Segueix youtubers)
        const strip = html.slice(html.indexOf('class="follow-suggest"'), html.indexOf('id="followTabs"'));
        expect(strip).not.toContain('<details');
        expect(strip).not.toContain('llista.cat');
        expect(strip).not.toContain('Abans de suggerir');
    });

    it('a mòbil la marca no se solapa amb la cerca: «Música» va sota «Segueix!» i, si no hi cap el nom, damunt del logo', () => {
        const css = fs.readFileSync(path.join(root, 'css', 'portada.css'), 'utf8');
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        expect(css).toMatch(/\.app-header \.brand \{\s*container-type: inline-size;\s*overflow: hidden;/);
        // «Música» a sota de «Segueix!», alineat a la dreta (les dues paraules acaben a la mateixa vertical)
        expect(css).toMatch(
            /\.app-header \.brand-tag \{\s*position: absolute;\s*top: calc\(100% - \d+px\);\s*right: 0;/
        );
        expect(css).toMatch(/@container \(max-width: 130px\) \{\s*\.app-header \.brand-name \{\s*display: none;/);
        expect(html).toContain('<span class="brand-mark__tag" aria-hidden="true">Música</span>');
        expect(css).toMatch(/@media \(max-width: 768px\) \{\s*\.brand-mark__tag \{\s*position: absolute;/);
    });

    it('la pàgina «Informació per a artistes» és de música: ràdios, visualitzacions, sense ànim de lucre i formulari', () => {
        const info = fs.readFileSync(path.join(root, 'info-youtubers.html'), 'utf8');
        // Ja no és la pàgina de Segueix youtubers
        expect(info).not.toContain('YouTubers');
        expect(info).toContain('Informació per a <span>artistes i grups</span>');
        expect(info).not.toMatch(/Gaming|Radar|Programes|categories intel·ligents/);
        // Projecte sense ànim de lucre per als músics i grups catalans
        expect(info).toContain('sense ànim de lucre');
        expect(info).toMatch(/músics i grups catalans/);
        // Com compten les visualitzacions
        expect(info).toContain('Com compten les visualitzacions als teus canals');
        expect(info).toContain('reproductor oficial de YouTube');
        expect(info).toContain('Font de trànsit → Externa');
        // Explica sense prometre res les cançons encadenades, la diferència visualitzacions/ingressos i Premium
        // La primera cançó amb el ▶ natiu de YouTube; les encadenades soles probablement no compten (documentació de YouTube)
        expect(info).toContain(
            'les cançons que la ràdio\n                encadena automàticament probablement no compten com a visualització'
        );
        expect(info).not.toContain('queda a criteri de YouTube');
        // A la fitxa de la cançó hi ha «Canal Youtube»; la subscripció es proposa amb la targeta
        expect(info).not.toContain("A la fitxa de cada cançó hi ha\n                «Subscriu-t'hi a YouTube»");
        expect(info).toContain('YouTube Premium');
        expect(info).not.toContain('Només no');
        // L'algorisme, amb els pesos del motor (music-selection.js) i els quatre modes de descoberta
        const sel = fs.readFileSync(path.join(root, 'js', 'features', 'music-selection.js'), 'utf8');
        expect(sel).toMatch(
            /weights: \{ taste: 0\.45, actuality: 0\.2, popularity: 0\.15, rotation: 0\.1, affinity: 0\.1 \}/
        );
        for (const pes of ['45 %', '20 %', '15 %', '10 %']) expect(info).toContain(pes);
        for (const mode of ['Els meus de sempre', 'Una mica de tot', 'Sorprèn-me', 'Fora del meu radar']) {
            expect(info).toContain(mode);
        }
        expect(info).toContain('65 %');
        expect(info).toContain('Ningú no pot pagar per sortir més');
        // El formulari és el de la configuració
        const url = config.match(/suggestYoutuberUrl:\s*"([^"]+)"/)?.[1];
        expect(info).toContain(`href="${url}"`);
        expect(info).toContain('https://t.me/segueix');
        expect(info).toContain('mailto:info.segueix@gmail.com');
        // Totes les ancores del menú existeixen
        const ids = [...info.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
        [...info.matchAll(/href="#([^"]+)"/g)].forEach(m => expect(ids).toContain(m[1]));
    });
});
