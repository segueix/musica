import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// L'app sempre és una ràdio (2026-10-18): cap camí no ha de tornar a la fitxa antiga d'un vídeo sol (reproductor,
// «Altres vídeos relacionats» i la columna amb els vídeos de l'artista).

const app = readFileSync('js/app.js', 'utf8');
const styles = readFileSync('css/styles.css', 'utf8');
const portada = readFileSync('css/portada.css', 'utf8');

const impl = (() => {
    const start = app.indexOf('async function showVideoFromAPILegacyImpl(');
    return app.slice(start, app.indexOf('\n}\n', start));
})();

describe('un vídeo que s’obre sol engega una ràdio', () => {
    it('showVideoFromAPI prova la ràdio abans de pintar res, si no ve d’una cua', () => {
        const fromQueue = impl.indexOf('const fromQueue = isPlaylistNavigation;');
        const early = impl.indexOf('if (!fromQueue && startRadioForSingleVideo(videoId, options)) return;');
        expect(fromQueue).toBeGreaterThan(-1);
        expect(early).toBeGreaterThan(fromQueue);
        expect(early).toBeLessThan(impl.indexOf('++playbackNavigationId'));
        expect(early).toBeLessThan(impl.indexOf('exitPlaylistMode()'));
    });

    it('un vídeo d’arxiu o de l’historial també fa ràdio un cop resolt, substituint l’entrada de l’historial', () => {
        expect(impl).toMatch(
            /if \(!fromQueue && cachedVideo && startRadioForSingleVideo\(videoId, \{ \.\.\.options, replaceHistory: true \}, cachedVideo\)\)/
        );
        // després de l'espera de l'índex d'arxiu no es pot llegir isPlaylistNavigation (ja és fals)
        const afterAwait = impl.slice(impl.indexOf('await withStartupTimeout'));
        expect(afterAwait).not.toMatch(/!isPlaylistNavigation && cachedVideo/);
    });

    it('la ràdio rep el segon, l’autoplay i si cal substituir l’historial', () => {
        const helper = app.slice(app.indexOf('function startRadioForSingleVideo('));
        expect(helper.slice(0, 700)).toMatch(/startFrom\?\.\(videoId, 'api', \{\s*video,\s*startAt: options\.startAt,/);
    });
});

describe('amb una cua (ràdio o llista) no hi ha relacionats a cap mida', () => {
    it('escriptori: també amb una llista pròpia, no només amb la ràdio', () => {
        expect(styles).toMatch(/#watchPage:has\(#playlistQueueContainer:not\(\.hidden\) \.mq\) \.watch-sidebar/);
        expect(styles).toMatch(/#watchPage:has\(#playlistQueueContainer:not\(\.hidden\) \.mq\) \.extra-videos-grid/);
        expect(styles).not.toMatch(/\.mq--radio\) \.watch-sidebar/);
    });

    it('mòbil i tauleta', () => {
        expect(portada).toMatch(/#watchPage:has\(#playlistQueueContainer:not\(\.hidden\) \.mq\) \.watch-sidebar/);
    });
});
