import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { loadScript } from './setup.js';

function setup() {
    const iframe = { contentWindow: {}, src: 'https://www.youtube.com/embed/aaaaaaaaaaa' };
    const timers = [];
    const context = loadScript('js/features/music-queue.js', {
        document: { addEventListener() {}, querySelector: () => null, getElementById: () => null,
            createElement: () => ({ textContent: '', get innerHTML() { return this.textContent; } }) },
        isPlaylistMode: true,
        activePlaylistId: '__music_queue__',
        activePlaylistName: 'Ràdio',
        activePlaylistQueue: [
            { id: 'aaaaaaaaaaa', title: 'Gat Rumberu', channelTitle: 'La Pegatina' },
            { id: 'bbbbbbbbbbb', title: 'Següent' },
            { id: 'ccccccccccc', title: 'Tercera' },
        ],
        currentPlaylistIndex: 0,
        currentVideoId: 'aaaaaaaaaaa',
        videoPlayer: { dataset: { playingVideoId: 'aaaaaaaaaaa' }, querySelector: () => iframe },
        autoplayBlockTimer: null,
        cancelLiveSwapFallback: vi.fn(),
        setAutoplayBlockedHint: vi.fn(),
        renderPlaylistQueue: vi.fn(),
        loadVideoInSequence: vi.fn(),
        setTimeout: fn => timers.push(fn),
    });
    return { context, iframe, timers, api: context.SegueixApp.features.musicQueue };
}

describe('Cançons no disponibles dins la ràdio', () => {
    it.each([100, 101, 150])('marca i salta un cop amb error %i', code => {
        const { context, iframe, timers, api } = setup();
        expect(api.handleUnavailableVideo(code, iframe)).toBe(true);
        expect(api.handleUnavailableVideo(code, iframe)).toBe(false);
        expect(context.cancelLiveSwapFallback).toHaveBeenCalledOnce();
        expect(timers).toHaveLength(1);
        timers[0]();
        expect(context.currentPlaylistIndex).toBe(1);
        expect(context.loadVideoInSequence).toHaveBeenCalledOnce();
        const container = { _mqBound: true, querySelector: () => null, innerHTML: '' };
        api.render(container);
        expect(container.innerHTML).toContain('No disponibles');
        expect(container.innerHTML).toContain('No disponible: Gat Rumberu');
        expect(container.innerHTML).toContain('Següent');
    });

    it.each([2, 5, 153, undefined])('no marca errors de configuració o transitoris (%s)', code => {
        const { api, iframe, timers } = setup();
        expect(api.handleUnavailableVideo(code, iframe)).toBe(false);
        expect(timers).toHaveLength(0);
    });

    it('no canvia la cançó si l’usuari navega durant l’avís', () => {
        const { context, api, iframe, timers } = setup();
        api.handleUnavailableVideo(100, iframe);
        context.currentVideoId = 'ccccccccccc';
        timers[0]();
        expect(context.loadVideoInSequence).not.toHaveBeenCalled();
    });

    it('s’atura al final sense bucle i conserva l’avís', () => {
        const { context, api, iframe, timers } = setup();
        context.activePlaylistQueue = context.activePlaylistQueue.slice(0, 1);
        api.handleUnavailableVideo(100, iframe);
        timers[0]();
        expect(context.currentPlaylistIndex).toBe(0);
        expect(context.loadVideoInSequence).not.toHaveBeenCalled();
    });

    it('avança també davant errors consecutius en reproductors nous', () => {
        const { context, api, iframe, timers } = setup();
        api.handleUnavailableVideo(100, iframe);
        timers.shift()();
        const second = { contentWindow: {} };
        context.currentVideoId = 'bbbbbbbbbbb';
        context.videoPlayer.dataset.playingVideoId = 'bbbbbbbbbbb';
        context.videoPlayer.querySelector = () => second;
        api.handleUnavailableVideo(150, second);
        timers.shift()();
        expect(context.currentPlaylistIndex).toBe(2);
        expect(context.loadVideoInSequence).toHaveBeenCalledTimes(2);
    });

    it('no actua fora de la ràdio o sobre una altra cançó', () => {
        const { context, api, iframe } = setup();
        context.activePlaylistId = 'llista';
        expect(api.handleUnavailableVideo(100, iframe)).toBe(false);
        context.activePlaylistId = '__music_queue__';
        context.videoPlayer.dataset.playingVideoId = 'bbbbbbbbbbb';
        expect(api.handleUnavailableVideo(100, iframe)).toBe(false);
    });

    it('només accepta errors de l’iframe principal i d’un origen YouTube exacte', () => {
        const source = readFileSync('js/app.js', 'utf8');
        const fn = source.match(/function handleYouTubeMessageLegacyImpl\(event\) \{[\s\S]*?\n\}/)[0];
        const iframe = { contentWindow: {} };
        const handler = vi.fn();
        const context = { videoPlayer: { querySelector: () => iframe },
            SegueixApp: { features: { musicQueue: { handleUnavailableVideo: handler } } } };
        runInNewContext(fn, context);
        const event = { origin: 'https://www.youtube.com', source: iframe.contentWindow,
            data: JSON.stringify({ event: 'onError', info: 100 }) };
        context.handleYouTubeMessageLegacyImpl({ ...event, origin: 'https://youtube.com.attacker.test' });
        context.handleYouTubeMessageLegacyImpl({ ...event, source: {} });
        expect(handler).not.toHaveBeenCalled();
        context.handleYouTubeMessageLegacyImpl(event);
        expect(handler).toHaveBeenCalledWith(100, iframe);
        iframe._musicUnavailableHandled = true;
        context.handleYouTubeMessageLegacyImpl(event);
        expect(handler).toHaveBeenCalledOnce();
        expect(source).toContain("args: ['onError']");
    });
});
