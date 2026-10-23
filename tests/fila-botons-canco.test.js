import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

// Fitxa de la cançó condensada, com YouTube (2026-10-23): sota el vídeo, el títol a 20 px, el canal i una sola fila de
// botons de 36 px (anterior · play · següent · m'agrada · flotant a l'esquerra; desar a una llista · comparteix · ⋯ a la
// dreta). «Més / Menys com aquesta» i «Comenta a YouTube» són al menú ⋯; la cua ja no els porta oberts a la cançó que
// sona. Substitueix la fila de 2026-10-20/21 (botons rodons de 44 px, ratlla entre YouTube i l'app) i la columna de
// controls a la dreta del vídeo.
const css = readFileSync('css/portada.css', 'utf8');
const app = readFileSync('js/app.js', 'utf8');
const queue = readFileSync('js/features/music-queue.js', 'utf8');
const block = css.slice(css.indexOf('   Fitxa de la cançó condensada, com YouTube (2026-10-23)'));
const row = app.slice(
    app.indexOf('<div class="video-metadata-bar">'),
    app.indexOf('// ==================== POSICIÓ DEL BOTÓ DE SUPORT')
);

describe('fitxa de la cançó condensada', () => {
    it('ja no hi ha la fila antiga (ratlla entre grups) ni els controls en columna', () => {
        expect(css).not.toContain("la fila de botons, tota junta a l'esquerra (2026-10-20)");
        expect(css).not.toContain('Ordinador: controls del reproductor normal a la dreta, fora del vídeo');
        expect(css).not.toMatch(/flex-direction: column;\s*flex-wrap: nowrap;\s*gap: 12px;\s*width: 60px;/);
    });

    it('els controls i les accions de l’app comparteixen la fila 5 de la graella', () => {
        expect(block).toMatch(/--wc-btn: 36px;/);
        expect(block).toMatch(
            /#watchPage \.watch-main > #playerExternalControls:not\(\.is-docked\) \{\s*grid-column: 1;\s*grid-row: 5;/
        );
        expect(block).toMatch(/> \.video-metadata-bar \{\s*grid-row: 5;/);
        expect(block).toMatch(/> \.video-metadata-bar \{\s*grid-column: 2;/);
        // .video-info, #channelInfo i .video-info-modern s'aplanen per col·locar els seus fills a la graella
        expect(block).toMatch(/> \.channel-info:not\(\.hidden\),[\s\S]*?display: contents;/);
    });

    it('títol a 20 px i botons de 36 px', () => {
        expect(block).toMatch(/\.watch-main \.video-title \{[^}]*font-size: 1\.25rem;/);
        expect(block).toMatch(/:is\(#playlistBtn, #shareBtn, #watchMoreBtn\) \{[^}]*height: var\(--wc-btn\);/);
    });

    it('desar a una llista porta la icona de llista amb «+», sense text', () => {
        const save = row.slice(row.indexOf('id="playlistBtn"'), row.indexOf('id="shareBtn"'));
        expect(save).toContain('aria-label="Desa a una llista"');
        expect(save).toContain('M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6');
        expect(save).not.toContain('watch-btn-label');
    });

    it('el menú ⋯ porta «Més / Menys com aquesta» i «Comenta a YouTube»', () => {
        expect(row).toContain('id="watchMoreBtn"');
        expect(row).toMatch(/aria-haspopup="menu"/);
        expect(row).toContain('data-watch-pref="more"');
        expect(row).toContain('data-watch-pref="less"');
        expect(row).toContain('Comenta a YouTube');
        expect(app).toMatch(/function initWatchMoreMenu\(\)/);
        expect(app).toMatch(/musicQueue\?\.applyPreference\?\.\(video, pref\.dataset\.watchPref\)/);
        // Mai cap amunt (quedaria damunt del vídeo): sempre cap avall
        expect(css).not.toContain('.watch-more__menu.is-up');
    });

    it('«Canal YouTube» porta el logotip de YouTube i va al requadre de la descripció', () => {
        const links = row.slice(row.indexOf('<div class="watch-yt-links">'));
        expect(links).toMatch(
            /class="btn-pill-red">\s*<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*Canal YouTube/
        );
        expect(block).toMatch(/> \.watch-yt-links \{\s*grid-row: 7;/);
    });

    it('la cançó que sona a la cua ja no porta «+ com aquesta −» obert', () => {
        expect(queue).toContain('data-mq-more aria-expanded="false"');
        expect(css).not.toMatch(/\.mq-item\.is-active \.mq-prefs \{\s*display: flex;/);
        expect(css).toMatch(/\.mq-item\.is-open \.mq-prefs \{\s*display: flex;/);
    });

    describe('ordinador (2026-10-23)', () => {
        it('controls a la dreta del títol (amb punts suspensius) i accions a la dreta del nom de l’artista', () => {
            const wide = block.slice(block.indexOf('/* Ordinador i tauleta (2026-10-23)'));
            expect(wide).toMatch(/#playerExternalControls:not\(\.is-docked\) \{\s*grid-column: 2;\s*grid-row: 3;/);
            expect(wide).toMatch(/> \.video-metadata-bar \{\s*grid-column: 2;\s*grid-row: 4;/);
            expect(wide).toMatch(/\.video-title \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
            expect(app).toContain("titleElement.title = title || '';");
        });

        it('reproductor més ample (16:9) i cua més estreta', () => {
            expect(block).toMatch(/--wc-q: clamp\(300px, 26vw, 380px\);/);
            expect(block).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto var\(--wc-q\);/);
            expect(block).toMatch(/> \.video-placeholder \{\s*aspect-ratio: 16 \/ 9;/);
        });

        it('sense la fitxa de l’artista ni relacionats a sota', () => {
            expect(block).toMatch(
                /#watchPage :is\(\.watch-sidebar, \.extra-related-title, \.extra-related-header, \.extra-videos-grid\) \{\s*display: none;/
            );
        });

        it('«Ràdio · 1/40» va a l’esquerra de tot del requadre', () => {
            expect(block).toMatch(/\.meta-left #playlistModeChip \{\s*order: 0;/);
            expect(block).toMatch(/\.meta-left #videoViews \{\s*order: 1;/);
        });
    });
});
