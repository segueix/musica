import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadScript } from './setup.js';

const page = loadScript('js/features/artist-page.js', { SegueixApp: { features: {}, state: {}, utils: {} } }).SegueixApp
    .features.artistPage;
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/portada.css', 'utf8');

describe('fitxa d’artista: estils per a la ràdio', () => {
    const labels = ['Pop', 'Folk i arrel', 'Jazz / Blues', 'Altres estils'];

    it('posa l’estil principal primer, amb el nom canònic i sense repetits', () => {
        expect(
            page.artistStyles({ categories: ['jazz / blues', 'pop', 'Folk i arrel'], primary: 'Folk i arrel', labels })
        ).toEqual(['Folk i arrel', 'Jazz / Blues', 'Pop']);
    });

    it('descarta les vistes generals i «Altres estils», i no passa de tres', () => {
        expect(page.artistStyles({ categories: ['Altres estils', 'Novetats', 'Seguint', 'Pop'], labels })).toEqual([
            'Pop',
        ]);
        expect(page.artistStyles({ categories: ['A', 'B', 'C', 'D', 'E'] })).toHaveLength(3);
        expect(page.artistStyles({})).toEqual([]);
    });
});

describe('fitxa d’artista: ràdios i presentació', () => {
    it('la ràdio de l’artista necessita almenys dues cançons i la d’estil, algun estil', () => {
        const ok = page.radiosModel({ name: 'Judit', styles: ['Pop'], songCount: 5 });
        expect(ok.artist.enabled).toBe(true);
        expect(ok.style.enabled).toBe(true);
        expect(ok.style.label).toContain('Pop');
        const few = page.radiosModel({ name: 'Judit', styles: [], songCount: 1 });
        expect(few.artist.enabled).toBe(false);
        expect(few.style.enabled).toBe(false);
        expect(page.radiosModel({ name: 'Judit', styles: ['Pop'], songCount: 9, loading: true }).artist.enabled).toBe(
            false
        );
    });

    it('la presentació conserva els paràgrafs però no els salts de línia buits seguits', () => {
        expect(page.bioModel('  Hola\r\n\r\n\r\n\r\nAdéu  ')).toEqual({ text: 'Hola\n\nAdéu', hasText: true });
        expect(page.bioModel('   ').hasText).toBe(false);
        expect(page.bioModel(null).hasText).toBe(false);
    });

    it('les cançons de la ràdio no inclouen Shorts', () => {
        expect(page.songsOf([{ id: 'a' }, { id: 'b', isShort: true }, null, {}]).map(v => v.id)).toEqual(['a']);
    });
});

describe('fitxa d’artista: HTML i CSS', () => {
    const channelPage = html.slice(html.indexOf('id="channelPage"'), html.indexOf('id="channelVideosGrid"'));

    it('té les dues ràdios a dalt de tot, abans de la capçalera i amb l’enrere', () => {
        const top = channelPage.indexOf('class="ap-top"');
        expect(top).toBeGreaterThan(-1);
        expect(channelPage.indexOf('data-ap-radio="artist"')).toBeGreaterThan(top);
        expect(channelPage.indexOf('data-ap-radio="style"')).toBeGreaterThan(
            channelPage.indexOf('data-ap-radio="artist"')
        );
        expect(channelPage.indexOf('id="channelBackBtn"')).toBeGreaterThan(top);
        expect(channelPage.indexOf('ap-hero')).toBeGreaterThan(channelPage.indexOf('data-ap-radio="style"'));
    });

    it('conserva els ids que fa servir app.js i la foto va dins la capçalera, després del nom', () => {
        [
            'channelProfileAvatar',
            'channelProfileName',
            'channelProfileHandle',
            'channelProfileSubscribers',
            'channelProfileDescription',
            'channelProfileTags',
            'channelProfileFollowBtn',
            'channelProfileHideBtn',
            'channelProfileShareBtn',
            'channelSupportBtn',
            'channelSearchInputDesktop',
            'channelSearchInputMobile',
        ].forEach(id => expect(channelPage, id).toContain(`id="${id}"`));
        expect(channelPage.indexOf('id="channelProfileAvatar"')).toBeGreaterThan(
            channelPage.indexOf('id="channelProfileName"')
        );
    });

    it('la presentació comença plegada, amb botó per expandir-la', () => {
        expect(channelPage).toMatch(/id="channelProfileDescription"[^>]*>/);
        expect(channelPage).toContain('is-collapsed');
        expect(channelPage).toContain('id="apBioToggle"');
        expect(channelPage).toContain('aria-expanded="false"');
        expect(css).toMatch(/\.channel-profile-description\.is-collapsed\s*{[^}]*-webkit-line-clamp:\s*3/);
    });

    it('les icones de la fitxa no depenen de lucide (CDN) i el botó d’enrere és tàctil', () => {
        expect(channelPage).not.toContain('data-lucide');
        expect(css).toMatch(/#channelPage \.channel-back-btn\s*{[^}]*width:\s*44px/);
        expect(css).toMatch(/\.ap-radio\s*{[^}]*min-height:\s*44px/);
    });

    it('carrega el mòdul després de music-queue.js i abans d’app.js', () => {
        const order = name => html.indexOf(`<script src="js/features/${name}.js`);
        expect(order('artist-page')).toBeGreaterThan(order('music-queue'));
        expect(html.indexOf('js/app.js')).toBeGreaterThan(order('artist-page'));
    });
});
