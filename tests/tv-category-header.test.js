import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contextTVSource = readFileSync(new URL('../js/features/context-tv.js', import.meta.url), 'utf8');
const segueixTVSource = readFileSync(new URL('../js/features/segueix-tv.js', import.meta.url), 'utf8');

describe('títols de TV i capçalera de Segueix TV', () => {
    it('mostra el nom de la categoria sense repetir · TV dins del reproductor', () => {
        expect(contextTVSource).toContain('name = value;');
        expect(contextTVSource).toContain('name = context.value;');
        expect(contextTVSource).not.toContain("name = `${value} · TV`;");
        expect(contextTVSource).not.toContain("name = `${context.value} · TV`;");
    });

    it('mostra Segueix sense el sufix TV al nom intern de la cua', () => {
        expect(segueixTVSource).toContain("activePlaylistName = 'Segueix';");
        expect(segueixTVSource).not.toContain("activePlaylistName = 'Segueix TV · Descoberta';");
    });

    it('posa la informació al costat del títol Segueix TV', () => {
        const titleStart = segueixTVSource.indexOf('<span class="segueix-tv-title-label">');
        const infoStart = segueixTVSource.indexOf('<span class="radar-info-wrap">', titleStart);
        const actionsStart = segueixTVSource.indexOf('<span class="page-title__actions">', titleStart);
        expect(titleStart).toBeGreaterThan(-1);
        expect(infoStart).toBeGreaterThan(titleStart);
        expect(actionsStart).toBeGreaterThan(infoStart);
        expect(segueixTVSource).toContain('Què és Segueix TV?');
        expect(segueixTVSource).toContain('descoberta contínua');
    });
    it('manté l hover de Segueix TV amb fons blanc i text negre', () => {
        expect(segueixTVSource).toContain('.segueix-tv-chip:hover,.segueix-tv-chip.is-active{background:#fff!important;color:#0f0f0f!important;opacity:1}');
        expect(segueixTVSource).toContain('.segueix-tv-chip:hover::before,.segueix-tv-chip:hover::after');
    });

});
