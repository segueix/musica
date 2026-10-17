import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

// Targeta de compartir d'una ràdio o llista: model, tall de línies, QR i coherència amb la marca.
// El dibuix en <canvas> i la lectura real del QR es verifiquen al navegador (tests/browser/verificar-compartir.js).

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const card = loadScript('js/utils/share-card.js').SegueixApp.utils.shareCard;

// Mesura de mentida: cada caràcter fa 10 px
const measure = text => text.length * 10;

describe('model de la targeta', () => {
    it('una ràdio diu «Ràdio» i una llista «Llista de reproducció», amb el nom', () => {
        const radio = card.buildShareModel({ type: 'radio', name: 'Pop + Rock', count: 30 });
        expect(radio.kindLabel).toBe('Ràdio');
        expect(radio.caption).toBe('Ràdio · Pop + Rock');
        expect(radio.countText).toBe('30 cançons');

        const llista = card.buildShareModel({ type: 'playlist', name: 'Música d’estiu', count: 1 });
        expect(llista.kindLabel).toBe('Llista de reproducció');
        expect(llista.caption).toBe('Llista de reproducció · Música d’estiu');
        expect(llista.countText).toBe('1 cançó');
    });

    it('neteja els espais del nom i hi posa un nom per defecte', () => {
        expect(card.buildShareModel({ type: 'playlist', name: '  Per   la\n tarda ' }).name).toBe('Per la tarda');
        expect(card.buildShareModel({ type: 'radio', name: '' }).name).toBe('La teva ràdio');
        expect(card.buildShareModel({ type: 'playlist', name: null }).name).toBe('Llista sense nom');
        expect(card.buildShareModel({ type: 'desconegut', name: 'X' }).kindLabel).toBe('Llista de reproducció');
    });

    it('sense cançons no hi ha recompte', () => {
        expect(card.buildShareModel({ type: 'radio', name: 'X' }).countText).toBe('');
        expect(card.buildShareModel({ type: 'radio', name: 'X', count: 0 }).count).toBe(0);
    });

    it('el nom del fitxer és net, sense accents ni símbols', () => {
        expect(card.buildShareModel({ type: 'radio', name: 'Hip-hop/Rap + Pop' }).fileName).toBe(
            'segueix-radio-hip-hop-rap-pop.png'
        );
        expect(card.buildShareModel({ type: 'playlist', name: 'Música d’estiu' }).fileName).toBe(
            'segueix-llista-musica-d-estiu.png'
        );
        expect(card.buildShareModel({ type: 'playlist', name: '***' }).fileName).toBe('segueix-llista-segueix.png');
        expect(card.slugify('A'.repeat(80)).length).toBeLessThanOrEqual(40);
    });
});

describe('tall de línies del nom', () => {
    it('reparteix les paraules en línies que hi caben', () => {
        const { lines, truncated } = card.wrapLines(measure, 'una dues tres quatre cinc', 100, 5);
        expect(lines).toEqual(['una dues', 'tres', 'quatre', 'cinc']);
        expect(truncated).toBe(false);
        expect(lines.every(line => measure(line) <= 100)).toBe(true);
    });

    it('parteix una paraula que no hi cap sola', () => {
        const { lines } = card.wrapLines(measure, 'ABCDEFGHIJKLMNOP', 60, 5);
        expect(lines.join('')).toBe('ABCDEFGHIJKLMNOP');
        expect(lines.every(line => measure(line) <= 60)).toBe(true);
    });

    it('si no hi cap, acaba l’última línia amb «…» sense passar-se', () => {
        const { lines, truncated } = card.wrapLines(measure, 'una dues tres quatre cinc sis set vuit', 80, 2);
        expect(truncated).toBe(true);
        expect(lines).toHaveLength(2);
        expect(lines[1].endsWith('…')).toBe(true);
        expect(lines.every(line => measure(line) <= 80)).toBe(true);
    });

    it('tria la mida més gran en què el nom cap en tres línies', () => {
        const measureAt = size => text => text.length * size * 0.5;
        const curt = card.fitLines(measureAt, 'Estiu', 940, 3, [120, 100, 80]);
        expect(curt.size).toBe(120);
        expect(curt.lines).toEqual(['Estiu']);

        const llarg = card.fitLines(
            measureAt,
            'Música per cantar a la dutxa quan no et sent ningú',
            940,
            3,
            [120, 100, 80]
        );
        expect(llarg.size).toBeLessThan(120);
        expect(llarg.lines.length).toBeLessThanOrEqual(3);
        expect(llarg.truncated).toBe(false);

        const enorme = card.fitLines(measureAt, 'paraula '.repeat(60), 940, 3, [120, 100, 80]);
        expect(enorme.size).toBe(80);
        expect(enorme.truncated).toBe(true);
    });
});

describe('QR amb la icona al mig', () => {
    it('com més llarg l’enllaç, menys correcció d’errors i icona més petita (perquè es llegeixi)', () => {
        const curt = card.qrSettings('x'.repeat(200));
        const mig = card.qrSettings('x'.repeat(600));
        const llarg = card.qrSettings('x'.repeat(1500));
        expect([curt.errorCorrectionLevel, mig.errorCorrectionLevel, llarg.errorCorrectionLevel]).toEqual([
            'H',
            'Q',
            'M',
        ]);
        expect(curt.imageSize).toBeGreaterThan(mig.imageSize);
        expect(mig.imageSize).toBeGreaterThan(llarg.imageSize);
        expect(curt.imageSize).toBeLessThanOrEqual(0.3);
    });

    it('un enllaç massa llarg no es converteix en QR', () => {
        expect(card.canEncode('https://segueix.github.io/musica/?importData=abc')).toBe(true);
        expect(card.canEncode('x'.repeat(card.MAX_QR_URL_LENGTH))).toBe(true);
        expect(card.canEncode('x'.repeat(card.MAX_QR_URL_LENGTH + 1))).toBe(false);
        expect(card.canEncode('')).toBe(false);
    });

    it('mòduls foscos sobre crema (contrast màxim), cantonades arrodonides i la icona de Segueix Música', () => {
        const config = card.buildQrConfig('https://segueix.github.io/musica/?importData=abc', 380, '/img/icon-512.png');
        expect(config.data).toBe('https://segueix.github.io/musica/?importData=abc');
        expect(config.width).toBe(380);
        expect(config.image).toBe('/img/icon-512.png');
        expect(config.imageOptions.hideBackgroundDots).toBe(true);
        expect(config.dotsOptions.color).toBe('#141615');
        expect(config.cornersSquareOptions.color).toBe('#141615');
        expect(config.backgroundOptions.color).toBe('#F4F0E8');
        expect(config.dotsOptions.type).toBe('rounded');
        expect(config.cornersSquareOptions.type).toBe('extra-rounded');
        expect(config.qrOptions.errorCorrectionLevel).toBe('H');
    });
});

describe('marca', () => {
    const css = read('css/portada.css');
    const token = name => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1].toLowerCase();

    it('els colors de la targeta són els de la paleta de Segueix Música', () => {
        expect(card.COLORS.bg.toLowerCase()).toBe(token('pt-bg'));
        expect(card.COLORS.text.toLowerCase()).toBe(token('pt-text'));
        expect(card.COLORS.accent.toLowerCase()).toBe(token('pt-accent'));
        expect(card.COLORS.terracotta.toLowerCase()).toBe(token('pt-terracotta'));
    });

    it('la targeta conserva la marca i la portada no espera una pantalla d’entrada', () => {
        const source = read('js/utils/share-card.js');
        expect(source).toContain("const word = 'SEGUEIX'");
        expect(source).toContain("ctx.fillStyle = COLORS.accent;\n        ctx.fillText('!'");
        expect(source).toContain('Fraunces');
        expect(read('index.html')).toContain('class="brand-name"');
        expect(read('index.html')).not.toContain('id="intro-splash"');
    });

    it('no hi queda res de Segueix youtubers (caràtula, vermell, segueix.cat)', () => {
        for (const file of ['js/utils/share-card.js', 'js/utils/qr-share.js', 'js/utils/share-codecs.js']) {
            const source = read(file);
            expect(source, file).not.toMatch(/caratula|#e94560|#1a1a2e|segueix\.cat/);
        }
    });

    it('els enllaços de compartició apunten a Segueix Música a GitHub Pages', () => {
        expect(read('js/utils/share-codecs.js')).toContain(
            "const SHARE_BASE_URL = window.SEGUEIX_PUBLIC_URL || 'https://segueix.github.io/musica/'"
        );
    });

    it('la imatge estàtica de les previsualitzacions existeix i és la d’index.html', () => {
        const html = read('index.html');
        expect(html).toContain('content="https://segueix.github.io/musica/img/compartir.png"');
        expect(html).toContain('<meta property="og:image:width" content="1200">');
        expect(html).toContain('<meta property="og:image:height" content="630">');
        const png = readFileSync(new URL('../img/compartir.png', import.meta.url));
        // Capçalera PNG: signatura + IHDR amb 1200 × 630
        expect(png.subarray(1, 4).toString()).toBe('PNG');
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
    });

    it('share-card.js es carrega abans de qr-share.js i és al precache del service worker', () => {
        const html = read('index.html');
        expect(html.indexOf('js/utils/share-card.js')).toBeGreaterThan(-1);
        expect(html.indexOf('js/utils/share-card.js')).toBeLessThan(html.indexOf('js/utils/qr-share.js'));
        expect(read('sw.js')).toContain("'./js/utils/share-card.js'");
    });
});
