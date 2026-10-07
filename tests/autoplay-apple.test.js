import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const appleDevice = navigator =>
    loadScript('js/utils/helpers.js', { YouTubeAPI: undefined, navigator }).isAppleDevice();

describe('isAppleDevice', () => {
    it('reconeix iPhone, iPad (també el que es presenta com a Mac) i Mac', () => {
        expect(
            appleDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' })
        ).toBe(true);
        expect(appleDevice({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', platform: 'iPad' })).toBe(
            true
        );
        expect(
            appleDevice({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                platform: 'MacIntel',
                maxTouchPoints: 5,
            })
        ).toBe(true);
        expect(
            appleDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Chrome/130', platform: 'MacIntel' })
        ).toBe(true);
    });

    it('no s’aplica a Android, Windows ni Linux', () => {
        expect(appleDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', platform: 'Linux armv8l' })).toBe(
            false
        );
        expect(appleDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' })).toBe(false);
        expect(appleDevice({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64' })).toBe(false);
    });
});

describe('Cua als aparells d’Apple: mateix reproductor i avís de bloqueig', () => {
    const app = read('js/app.js');
    const html = read('index.html');
    const css = read('css/portada.css');

    it('la cua amb autoplay reutilitza el reproductor només als aparells d’Apple', () => {
        expect(app).toMatch(/\(autoPlay && canKeepApplePlayer\(\)\)/);
        expect(app).toMatch(
            /function canKeepApplePlayer\(\) \{[\s\S]*?isAppleDevice\(\)[\s\S]*?visibilityState !== 'hidden'/
        );
        expect(app).toMatch(/options\.keepLivePlayer === true &&\s*canKeepLivePlayer\(\)/);
    });

    it('la vigilància de l’autoplay només avisa als aparells d’Apple i amb estats sense començar', () => {
        expect(app).toMatch(/function watchAppleAutoplay[\s\S]*?!isAppleDevice\(\)/);
        expect(app).toMatch(/state === '' \|\| state === '-1' \|\| state === '5'/);
        expect(app.match(/watchAppleAutoplay\(/g).length).toBeGreaterThanOrEqual(4);
    });

    it('l’avís és dins la barra de sota el reproductor, no damunt del vídeo', () => {
        const bar = html.slice(html.indexOf('id="playerExternalControls"'), html.indexOf('<div class="video-info">'));
        expect(bar).toContain('id="playerAutoplayHint"');
        expect(bar).toMatch(/id="playerAutoplayHint"[^>]*hidden/);
        expect(css).toContain('.player-external-controls.is-autoplay-blocked .player-external-btn--main');
        expect(css).toContain('.player-external-controls.is-docked .player-autoplay-hint');
    });
});
