import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadScript } from './setup.js';

const css = fs.readFileSync('css/portada.css', 'utf8');
const start = css.indexOf('«La teva música» amb el llenguatge de caràtules');
const block = css.slice(start);

describe('«La teva música» amb el llenguatge de caràtules', () => {
    it('el bloc és al full de la portada', () => {
        expect(start).toBeGreaterThan(-1);
    });

    it('historial: caràtules quadrades plenes, text al damunt i «Fa 1 h» en càpsula', () => {
        expect(block).toMatch(/#playlistsPage \.mm-card \{[^}]*aspect-ratio: 1;[^}]*border: 2px solid transparent;/);
        expect(block).toMatch(/#playlistsPage \.mm-card__thumb \{[^}]*position: absolute;[^}]*inset: 0;/);
        expect(block).toMatch(
            /#playlistsPage \.mm-card__when \{[^}]*position: absolute;[^}]*border-radius: var\(--pt-radius-pill\);/
        );
    });

    it('artistes: requadres plens amb la foto (a 400 px) i el nom a dins', () => {
        expect(block).toMatch(/#playlistsPage \.mm-artist \{[^}]*aspect-ratio: 1;/);
        expect(block).toMatch(
            /#playlistsPage \.mm-artist__avatar \{[^}]*position: absolute;[^}]*inset: 0;[^}]*border-radius: 0;/
        );
        const ctx = loadScript('js/features/my-music.js');
        const { photoUrl } = ctx.SegueixApp.features.myMusic;
        expect(photoUrl('https://yt3.ggpht.com/abc=s88-c-k-c0x00ffffff-no-rj')).toBe(
            'https://yt3.ggpht.com/abc=s400-c-k-c0x00ffffff-no-rj'
        );
        expect(photoUrl('img/icon-192.png')).toBe('img/icon-192.png');
    });

    it('llistes: la caràtula de fons amb el nom, compartir i el play al damunt', () => {
        expect(block).toMatch(
            /#playlistsPage \.playlist-card \{[^}]*--pl-cover: 56\.25cqi;[^}]*container-type: inline-size;/
        );
        expect(block).toMatch(
            /#playlistsPage \.playlist-card-title-row \{[^}]*position: absolute;[^}]*top: calc\(var\(--pl-cover\) - 82px\);/
        );
        expect(block).toMatch(/#playlistsPage \.playlist-play-btn \{[^}]*border-radius: 50%;[^}]*background: #fff/);
        expect(block).toMatch(/#playlistsPage \.playlist-card \.library-share-btn \{[^}]*position: absolute;/);
    });

    it('el marc blanc només en passar-hi el ratolí o amb el teclat', () => {
        expect(block).toMatch(/#playlistsPage :is\(\.mm-card, \.mm-artist\):focus-visible \{[^}]*border-color: #fff;/);
        expect(block).toMatch(
            /@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?#playlistsPage :is\(\.mm-card, \.mm-artist\):is\(:hover, :focus-visible\) \{[^}]*border-color: #fff;[^}]*transform: scale\(1\.04\);/
        );
    });

    it('llistes: les quatre primeres caràtules en mosaic', () => {
        const app = fs.readFileSync('js/app.js', 'utf8');
        expect(app).toMatch(/function playlistCoverMarkup\(list, fallback\)/);
        expect(app).toMatch(/\$\{playlistCoverMarkup\(list, thumbnail\)\}/);
        expect(app).toMatch(/<span class="playlist-mosaic__tile"><img src=/);
        expect(block).toMatch(
            /#playlistsPage \.playlist-mosaic \{[^}]*position: absolute;[^}]*inset: 0;[^}]*display: grid;/
        );
        expect(block).toMatch(/#playlistsPage \.playlist-mosaic__tile \{[^}]*overflow: hidden;/);
    });

    it('«+ Afegeix cançons» va damunt del mosaic de la llista, sense caràtules pròpies', () => {
        const app = fs.readFileSync('js/app.js', 'utf8');
        expect(app).toMatch(/data-add-songs="\$\{escapeHtml\(list\.id\)\}">\+ Afegeix cançons<\/button>/);
        expect(app).not.toMatch(/playlistAddSongsStyle/);
        expect(block).not.toMatch(/var\(--pl-add-/);
        expect(block).toMatch(
            /#playlistsPage \.playlist-card \.playlist-add-songs \{[^}]*position: absolute;[^}]*top: 10px;[^}]*left: 12px;[^}]*background: rgba\(20, 22, 21, 0\.55\);[^}]*backdrop-filter: blur\(6px\);/
        );
    });
});
