import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coreSource = readFileSync(new URL('../js/core/segueix-app.js', import.meta.url), 'utf8');
const polishSource = readFileSync(new URL('../js/features/shorts-polish.js', import.meta.url), 'utf8');

describe('Shorts polish', () => {
    it('carrega el complement de Shorts sense modificar el reproductor base', () => {
        expect(coreSource).toContain("script.src = '/js/features/shorts-polish.js'");
        expect(polishSource).toContain('short-native-controls-cover');
        expect(polishSource).not.toContain('contentDocument');
    });

    it('manté el pòster sobre els controls natius durant navegació per scroll o lliscament', () => {
        expect(polishSource).toContain("overlay.addEventListener('wheel'");
        expect(polishSource).toContain("overlay.addEventListener('touchend'");
        expect(polishSource).toContain('holdNativeControlsCover()');
        expect(polishSource).toContain("payload?.event === 'onStateChange'");
        expect(polishSource).toContain('event.source !== currentIframe.contentWindow');
        expect(polishSource).toContain('NATIVE_CONTROLS_SETTLE_MS');
    });

    it('resol les visualitzacions pel vídeo real del Short', () => {
        expect(polishSource).toContain('app.state?.shorts?.currentShortsQueue');
        expect(polishSource).toContain("const FEED_CACHE_KEY = 'catube_feed_v1'");
        expect(polishSource).toContain("args: ['infoDelivery']");
        expect(polishSource).toContain("payload?.event === 'infoDelivery'");
        expect(polishSource).toContain('info?.videoData?.video_id');
        expect(polishSource).toContain("window.fetch('/data/feed.json'");
        expect(polishSource).toContain('video?.viewCount');
        expect(polishSource).toContain("element.id = 'shortViews'");
        expect(polishSource).toContain('visualitzacions');
    });
});
