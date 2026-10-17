import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadScript } from './setup.js';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/portada.css', 'utf8');
const styles = fs.readFileSync('css/styles.css', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

const ctx = loadScript('js/features/app-install.js');
const install = ctx.SegueixApp.features.appInstall;

const UA = {
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    iphoneChrome:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    android:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    samsung:
        'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
    windowsEdge:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',
    windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    chromebook:
        'Mozilla/5.0 (X11; CrOS x86_64 15917.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    macSafari:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};

describe('Instal·la l’app: aparell i navegador', () => {
    it.each([
        ['iphone', 0, 'ios', 'safari'],
        ['iphoneChrome', 5, 'ios', 'chrome'],
        ['ipad', 5, 'ios', 'safari'],
        ['android', 5, 'android', 'chrome'],
        ['samsung', 5, 'android', 'samsung'],
        ['windowsEdge', 0, 'windows', 'edge'],
        ['windowsFirefox', 0, 'windows', 'firefox'],
        ['chromebook', 0, 'chromeos', 'chrome'],
        ['macSafari', 0, 'mac', 'safari'],
        ['linux', 0, 'linux', 'chrome'],
    ])('%s → %s / %s', (key, maxTouchPoints, os, browser) => {
        const device = install.detectDevice({ userAgent: UA[key], maxTouchPoints });
        expect(device.os).toBe(os);
        expect(device.browser).toBe(browser);
    });

    it('Linux fa servir la fila de Windows; un sistema desconegut no en té', () => {
        expect(install.deviceRow('linux').id).toBe('windows');
        expect(install.deviceRow('other')).toBeNull();
    });

    it('té passos per a Android, iPhone, Windows, Chromebook i Mac', () => {
        expect(install.DEVICES.map(device => device.id)).toEqual(['android', 'ios', 'windows', 'chromeos', 'mac']);
        for (const device of install.DEVICES) {
            expect(install.stepsFor(device.id, device.browser).steps.length).toBeGreaterThan(1);
        }
        expect(install.stepsFor('ios', 'safari').steps.join(' ')).toContain("Afegeix a la pantalla d'inici");
        expect(install.stepsFor('ios', 'chrome').note).toContain('Safari');
        expect(install.stepsFor('mac', 'safari').steps.join(' ')).toContain('Afegeix al Dock');
        expect(install.stepsFor('windows', 'firefox').note).toContain('Chrome o Edge');
    });

    it('detecta quan ja s’obre com a app', () => {
        const win = query => ({ navigator: {}, matchMedia: q => ({ matches: q === query }) });
        expect(install.isStandalone(win('(display-mode: standalone)'))).toBe(true);
        expect(install.isStandalone(win('(display-mode: browser)'))).toBe(false);
        expect(install.isStandalone({ navigator: { standalone: true } })).toBe(true);
    });

    it('la finestra marca l’aparell i només ofereix «Instal·la ara» si el navegador ho permet', () => {
        const withPrompt = install.dialogHtml({ os: 'android', browser: 'chrome', canPrompt: true });
        expect(withPrompt).toContain('data-ai-now');
        expect(withPrompt).toMatch(/class="ai-chip is-mine">[\s\S]*?Android/);
        expect(withPrompt).toContain('data-ai-share');
        const ios = install.dialogHtml({ os: 'ios', browser: 'safari', canPrompt: false });
        expect(ios).not.toContain('data-ai-now');
        expect(ios).toContain('iPhone i iPad');
        const unknown = install.dialogHtml({ os: 'other', browser: 'other', canPrompt: false });
        expect(unknown).toContain('<details class="ai-others" open>');
    });
});

describe('Instal·la l’app: integració', () => {
    it('el botó és a dalt de tot d’Inici, abans de l’entrada, amb les icones dels aparells', () => {
        const home = html.indexOf('id="homePage"');
        const button = html.indexOf('id="ptInstallBtn"');
        expect(button).toBeGreaterThan(home);
        expect(button).toBeLessThan(html.indexOf('id="portadaEntry"'));
        expect(html).toContain("<strong>Instal·la l'app</strong>");
        expect(html).toContain('Directament o comparteix-la');
        expect(html).not.toMatch(/botiga/i);
        expect(fs.readFileSync('js/features/app-install.js', 'utf8')).not.toMatch(/botiga/i);
        expect(html).toContain('aria-label="Per a Android, iPhone, Windows i Chromebook"');
    });

    it('al costat hi ha «Comparteix», que comparteix l’app directament', () => {
        const share = html.indexOf('id="ptInstallShare"');
        expect(share).toBeGreaterThan(html.indexOf('id="ptInstallBtn"'));
        expect(share).toBeLessThan(html.indexOf('id="portadaEntry"'));
        expect(html).toContain('aria-label="Comparteix l\'app"');
        expect(fs.readFileSync('js/features/app-install.js', 'utf8')).toContain(
            "$('ptInstallShare')?.addEventListener('click', shareApp);"
        );
    });

    it('a la dreta, només a la portada i mai quan ja és instal·lada', () => {
        expect(css).toMatch(/\.pt-install \{[^}]*justify-content: flex-end;/);
        expect(css).toMatch(/#homePage:not\(\.is-portada\) \.pt-install \{[^}]*display: none;/s);
        expect(css).toContain('@media (display-mode: standalone)');
    });

    it('ja no hi ha el botó flotant antic en anglès', () => {
        expect(appJs).not.toContain('Install App');
        expect(appJs).not.toContain('install-floating-btn');
        expect(styles).not.toContain('.install-floating-btn');
        expect(appJs).toMatch(/function initInstallPrompt\(\) \{\s*SegueixApp\.features\.appInstall\?\.init\?\.\(\);/);
    });

    it('es carrega abans d’app.js i és al precache', () => {
        expect(html.indexOf('js/features/app-install.js')).toBeGreaterThan(0);
        expect(html.indexOf('js/features/app-install.js')).toBeLessThan(html.indexOf('js/app.js'));
        expect(sw).toContain("'./js/features/app-install.js'");
    });
});
