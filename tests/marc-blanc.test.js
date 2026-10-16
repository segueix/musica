import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// El marc blanc com a senyal (2026-10-16): sense marc en repòs a les graelles i files; apareix en passar-hi el
// ratolí o en enfocar-les; fix només a «La més escoltada», la cançó que sona i «Per afinitat».
const css = fs.readFileSync('css/portada.css', 'utf8');
const start = css.indexOf('/* ---------- El marc blanc com a senyal (2026-10-16)');
// Sense el comentari: des del primer selector
const block = css.slice(css.indexOf('*/', start) + 2);

describe('marc blanc', () => {
    it('en repòs, transparent a les graelles i files (sense moure res)', () => {
        const rest = block.slice(0, block.indexOf('}'));
        for (const selector of [
            '#channelPage .ap-grid .ap-card__art',
            ':is(#homePage.is-style-view #videosGrid, #homePage .search-results .videos-grid) .video-card',
            ':is(#followPage, .search-results) .follow-card',
            '#homePage.is-portada :is(.pt-card, .pt-portrait, .pt-quick)',
            '#homePlaylists .hp-item > .hp-card',
            'body .mq .mq-item:not(.is-active) .mq-cover',
        ]) {
            expect(rest, selector).toContain(selector);
        }
        expect(rest).toMatch(/border-color: transparent;\s*background-clip: padding-box;/);
    });

    it('apareix en passar-hi el ratolí i en enfocar-les', () => {
        expect(block).toMatch(/:focus-within[\s\S]*?\{\s*border-color: #fff;/);
        expect(block).toMatch(
            /@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?:hover[\s\S]*?\{\s*border-color: #fff;/
        );
    });

    it('les protagonistes conserven el marc fix (#1, la que sona, «Per afinitat»)', () => {
        const rest = block.slice(0, block.indexOf('}'));
        expect(rest).not.toContain('#apBest');
        expect(rest).not.toContain('.af-card');
        expect(rest).toContain(':not(.is-active)');
    });
});
