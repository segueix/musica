import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tvProgrammingSource = readFileSync(new URL('../js/features/tv-programming.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('programació de TV', () => {
    it('integra el panell entre el canal i la cua i carrega el controlador després de l app', () => {
        const channelInfo = indexSource.indexOf('id="channelInfo"');
        const panel = indexSource.indexOf('id="tvProgrammingPanel"');
        const queue = indexSource.indexOf('id="playlistQueueContainer"');
        const appScript = indexSource.indexOf('js/app.js?v=');
        const programmingScript = indexSource.indexOf('js/features/tv-programming.js?v=');

        expect(channelInfo).toBeGreaterThan(-1);
        expect(panel).toBeGreaterThan(channelInfo);
        expect(queue).toBeGreaterThan(panel);
        expect(programmingScript).toBeGreaterThan(appScript);
    });

    it('mostra Ara, A continuació i el progrés del vídeo actual', () => {
        expect(tvProgrammingSource).toContain('ARA');
        expect(tvProgrammingSource).toContain('A CONTINUACIÓ');
        expect(tvProgrammingSource).toContain('data-tv-progress-bar');
        expect(tvProgrammingSource).toContain('data-tv-progress-time');
        expect(tvProgrammingSource).toContain("payload?.event !== 'infoDelivery'");
    });

    it('avisa quan falten 15 segons i permet saltar al següent vídeo', () => {
        expect(tvProgrammingSource).toContain('const WARNING_SECONDS = 15');
        expect(tvProgrammingSource).toContain('remaining > WARNING_SECONDS');
        expect(tvProgrammingSource).toContain('function advanceToNext()');
        expect(tvProgrammingSource).toContain('currentPlaylistIndex = (getIndex() + 1) % queue.length');
        expect(tvProgrammingSource).toContain('loadVideoInSequence()');
    });

    it('evita duplicar Ara i A continuació dins de la resta de la cua', () => {
        expect(tvProgrammingSource).toContain('tv-programming-duplicate');
        expect(tvProgrammingSource).toContain("item === active || (next && next !== active && item === next)");
    });

    it('inclou el nou controlador al precache del service worker', () => {
        expect(swSource).toContain("'./js/features/tv-programming.js'");
        // La versió la calcula npm run sw:version a partir del contingut (abans s'escrivia a mà)
        expect(swSource).toMatch(/const CACHE_VERSION = '[0-9a-f]{12}';/);
    });
});
