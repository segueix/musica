import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const polishSource = readFileSync(new URL('../js/features/shorts-polish.js', import.meta.url), 'utf8');

describe('Shorts polish', () => {
    // Segueix Música no mostra Shorts (2026-10-04): segueix-app.js ja no carrega shorts-polish.js.
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
