import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import vm from 'node:vm';

// Segueix Música no mostra Shorts enlloc (2026-10-04): ni al feed, ni a l'historial, ni a la fitxa d'artista.
const read = file => readFileSync(file, 'utf8');

describe('sense Shorts', () => {
    it('totes les fonts de vídeos de l’app descarten els Shorts (i els amagats)', () => {
        // YouTubeAPI és un `const` de l'script: s'exposa al final per poder-lo provar
        const sandbox = { window: {}, console, localStorage: { getItem: () => null, setItem() {} } };
        vm.runInNewContext(`${read('js/youtube.js')}\nthis.YouTubeAPI = YouTubeAPI;`, sandbox);
        const { YouTubeAPI } = sandbox;
        YouTubeAPI.hiddenVideoIds = new Set(['amagat']);
        const out = YouTubeAPI.filterHiddenVideos([
            { id: 'a' },
            { id: 'short', isShort: true },
            { id: 'amagat' },
            { id: 'fals', isShort: false },
        ]);
        expect(out.map(video => video.id)).toEqual(['a', 'fals']);
    });

    it('el generador i l’arxivador no publiquen Shorts', () => {
        expect(read('scripts/update_music_feed.js')).toMatch(
            /if\(videos\[i\]\?\.isShort!==true\) continue;[\s\S]{0,80}videos\.splice\(i,1\)/
        );
        expect(read('scripts/archivar_feed_musical.js')).toContain(
            'const notShort = video => video?.isShort !== true;'
        );
    });

    it('la interfície ja no té cap fila ni filtre de Shorts', () => {
        const app = read('js/app.js');
        expect(app).not.toContain('<h2 class="shorts-title">Shorts</h2>');
        expect(app).not.toContain('renderShortsHistoryCarousel');
        expect(read('index.html')).not.toContain('data-history-cat="Shorts"');
    });
});
