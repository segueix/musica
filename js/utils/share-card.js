// ==================== TARGETA DE COMPARTIR ====================
// Imatge que es comparteix (WhatsApp, Instagram, Telegram...) quan es comparteix una ràdio o una llista de
// reproducció: icona de Segueix Música, «Segueix!» com a l'obertura de l'app, el tipus («Ràdio» / «Llista de
// reproducció»), el nom i un QR que obre la ràdio/llista. No porta cap enllaç escrit.
//
// Dues parts:
//   · funcions PURES (model, text, tall de línies, ajust de mida, ajustos del QR): testades a tests/share-card.test.js;
//   · el dibuix en un <canvas> (renderCard) i l'enviament (shareImage / downloadBlob): només al navegador.
// Depèn de (només per al QR): QRCodeStyling (qr-code-styling via CDN).

(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') {
        const app = root.SegueixApp || (root.SegueixApp = {});
        app.utils = app.utils || {};
        app.utils.shareCard = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    // Paleta de Segueix Música (la mateixa de css/portada.css)
    const COLORS = {
        bg: '#141615',
        surface: '#202421',
        text: '#F4F0E8',
        muted: '#B9B4AA',
        accent: '#D6ED84',
        terracotta: '#D98A70',
        terracottaDark: '#A9492B',
    };

    const CARD_WIDTH = 1080;
    const CARD_HEIGHT = 1350; // alçada habitual: creix si el QR és gros
    const QR_BASE_SIZE = 380;
    // La icona es resol respecte a aquest script: l'app canvia la ruta de la URL (/video/<títol>-<id>) i un
    // «img/icon-512.png» relatiu deixaria de trobar-se just quan es comparteix des del reproductor.
    const SCRIPT_SRC = (root.document && root.document.currentScript && root.document.currentScript.src) || '';
    const ICON_URL = (() => {
        try {
            return SCRIPT_SRC ? new URL('../../img/icon-512.png', SCRIPT_SRC).href : 'img/icon-512.png';
        } catch (_error) {
            return 'img/icon-512.png';
        }
    })();

    const KINDS = {
        radio: { label: 'Ràdio', fallbackName: 'La teva ràdio', slug: 'radio' },
        playlist: { label: 'Llista de reproducció', fallbackName: 'Llista sense nom', slug: 'llista' },
        category: { label: 'Categoria', fallbackName: 'Categoria', slug: 'categoria' },
        history: { label: 'Visualitzacions', fallbackName: 'Visualitzacions', slug: 'visualitzacions' },
    };

    // ---------- Funcions pures ----------

    function cleanName(value) {
        return String(value == null ? '' : value)
            .replace(/\s+/g, ' ')
            .trim();
    }

    function countText(count) {
        const total = Number(count);
        if (!Number.isFinite(total) || total <= 0) return '';
        return total === 1 ? '1 cançó' : `${Math.floor(total)} cançons`;
    }

    function slugify(value) {
        return (
            String(value || '')
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 40) || 'segueix'
        );
    }

    // Què es mostra: tipus, nom, nombre de cançons, text curt («Ràdio · Pop») i nom del fitxer.
    function buildShareModel(input = {}) {
        const kind = KINDS[input.type] ? input.type : 'playlist';
        const info = KINDS[kind];
        const name = cleanName(input.name) || info.fallbackName;
        return {
            type: kind,
            kindLabel: info.label,
            name,
            count: Number(input.count) > 0 ? Math.floor(Number(input.count)) : 0,
            countText: countText(input.count),
            caption: `${info.label} · ${name}`,
            fileName: `segueix-${info.slug}-${slugify(name)}.png`,
        };
    }

    // Talla un text en línies que no passin de maxWidth. `measure(text)` retorna l'amplada en píxels.
    // Les paraules més llargues que una línia es parteixen; si no hi cap, l'última línia acaba en «…».
    function wrapLines(measure, text, maxWidth, maxLines) {
        const words = cleanName(text).split(' ').filter(Boolean);
        const lines = [];
        let current = '';
        let truncated = false;

        const push = line => {
            if (lines.length < maxLines) lines.push(line);
            else truncated = true;
        };

        for (const rawWord of words) {
            let word = rawWord;
            while (measure(word) > maxWidth && word.length > 1) {
                let cut = word.length - 1;
                while (cut > 1 && measure(word.slice(0, cut)) > maxWidth) cut -= 1;
                if (current) {
                    push(current);
                    current = '';
                }
                push(word.slice(0, cut));
                word = word.slice(cut);
            }
            const candidate = current ? `${current} ${word}` : word;
            if (!current || measure(candidate) <= maxWidth) {
                current = candidate;
            } else {
                push(current);
                current = word;
            }
        }
        if (current) push(current);

        if (truncated && lines.length) {
            let last = lines[lines.length - 1];
            while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
            lines[lines.length - 1] = `${last}…`;
        }
        return { lines, truncated };
    }

    // Tria la mida de lletra més gran (de la llista, de gran a petita) en què el nom cap en maxLines línies.
    // `measureAt(size)` retorna la funció d'amplada per a aquesta mida.
    function fitLines(measureAt, text, maxWidth, maxLines, sizes) {
        const list = Array.isArray(sizes) && sizes.length ? sizes : [120, 104, 88, 76, 64];
        for (const size of list) {
            const result = wrapLines(measureAt(size), text, maxWidth, maxLines);
            if (!result.truncated) return { size, lines: result.lines, truncated: false };
        }
        const size = list[list.length - 1];
        const result = wrapLines(measureAt(size), text, maxWidth, maxLines);
        return { size, lines: result.lines, truncated: result.truncated };
    }

    // QR més llarg que això no hi cap (límit de la versió 40) o no es llegeix bé des d'una pantalla.
    const MAX_QR_URL_LENGTH = 1900;

    function canEncode(url) {
        const length = String(url || '').length;
        return length > 0 && length <= MAX_QR_URL_LENGTH;
    }

    // Un QR amb el logo al mig perd dades: com més llarg l'enllaç (llistes grans), més correcció d'errors
    // cal sacrificar i més petit ha de ser el logo perquè el QR continuï llegint-se bé.
    function qrSettings(url) {
        const length = String(url || '').length;
        if (length <= 380) return { errorCorrectionLevel: 'H', imageSize: 0.27 };
        if (length <= 900) return { errorCorrectionLevel: 'Q', imageSize: 0.22 };
        return { errorCorrectionLevel: 'M', imageSize: 0.17 };
    }

    // Opcions de QRCodeStyling: mòduls foscos sobre crema (màxim contrast per llegir-lo), cantonades arrodonides
    // i la icona de Segueix Música al centre.
    function buildQrConfig(url, size, iconSrc) {
        const settings = qrSettings(url);
        return {
            width: size,
            height: size,
            margin: 0,
            data: url,
            type: 'canvas',
            image: iconSrc || ICON_URL,
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: 6,
                imageSize: settings.imageSize,
                hideBackgroundDots: true,
            },
            dotsOptions: { color: COLORS.bg, type: 'rounded' },
            cornersSquareOptions: { color: COLORS.bg, type: 'extra-rounded' },
            cornersDotOptions: { color: COLORS.bg, type: 'dot' },
            backgroundOptions: { color: COLORS.text },
            qrOptions: { errorCorrectionLevel: settings.errorCorrectionLevel },
        };
    }

    // ---------- Dibuix (navegador) ----------

    // Cap pas del dibuix pot quedar penjat: passat el temps, es rebutja i la targeta es fa sense aquell element.
    function withTimeout(promise, ms, label) {
        let timer;
        const timeout = new Promise((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(`${label}: massa lent`)), ms);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    function loadImage(src) {
        return withTimeout(
            new Promise((resolve, reject) => {
                const image = new Image();
                image.crossOrigin = 'anonymous';
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error(`No s'ha pogut carregar ${src}`));
                image.src = src;
            }),
            8000,
            'imatge'
        );
    }

    // Les lletres de la targeta (Fraunces, Roboto) les carrega la pàgina; ens assegurem que són a punt abans de dibuixar.
    async function ensureFonts(sampleText) {
        if (!root.document?.fonts?.load) return;
        const load = Promise.all([
            root.document.fonts.load('700 100px Fraunces', sampleText),
            root.document.fonts.load('900 40px Roboto', sampleText),
            root.document.fonts.load('700 40px Roboto', sampleText),
        ]).catch(() => {});
        await Promise.race([load, new Promise(resolve => setTimeout(resolve, 1500))]);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function setSpacing(ctx, px) {
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
    }

    const DISPLAY_FONT = "Fraunces, 'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
    const SANS_FONT = "Roboto, 'Helvetica Neue', Arial, sans-serif";

    // «Segueix!» com a l'obertura de l'app: Fraunces en majúscules, crema, i el «!» en llima.
    function drawWordmark(ctx, x, baseline, size) {
        ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
        setSpacing(ctx, 0);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const word = 'SEGUEIX';
        ctx.fillStyle = COLORS.text;
        ctx.fillText(word, x, baseline);
        const width = ctx.measureText(word).width;
        ctx.fillStyle = COLORS.accent;
        ctx.fillText('!', x + width, baseline);
    }

    function drawBackground(ctx, w, h) {
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, w, h);

        // Cercle llima tallat a dalt a la dreta
        ctx.fillStyle = COLORS.accent;
        ctx.beginPath();
        ctx.arc(w - 40, -10, 290, 0, Math.PI * 2);
        ctx.fill();

        // Anell terracota al voltant del cercle llima: tota la decoració queda a dalt, lluny del nom
        ctx.strokeStyle = COLORS.terracotta;
        ctx.lineWidth = 40;
        ctx.beginPath();
        ctx.arc(w - 120, 70, 300, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Retorna un Promise<Blob> amb el PNG de la targeta. `url` és l'enllaç que obre el QR (si no hi és o no hi ha la
    // llibreria de QR, la targeta es dibuixa igualment sense QR).
    async function renderCard(model, url, options = {}) {
        const doc = root.document;
        const iconSrc = options.iconSrc || ICON_URL;

        await ensureFonts(`${model.name} ${model.kindLabel} SEGUEIX! MÚSICA EN CATALÀ Escaneja i escolta`);
        const icon = await loadImage(iconSrc).catch(() => null);

        // El QR es genera directament a la mida en què es dibuixa i amb mòduls d'un nombre enter de píxels (mínim 3):
        // reescalar-lo li esborraria el contrast i a les llistes llargues no se'n llegiria ni un.
        let qrImage = null;
        let qrSize = QR_BASE_SIZE; // costat de la caixa reservada al QR
        let qrDrawSize = QR_BASE_SIZE; // costat real del QR (enter de píxels per mòdul), centrat a la caixa
        if (canEncode(url) && typeof root.QRCodeStyling === 'function') {
            try {
                let qr = new root.QRCodeStyling(buildQrConfig(url, QR_BASE_SIZE, iconSrc));
                const modules = qr._qr && typeof qr._qr.getModuleCount === 'function' ? qr._qr.getModuleCount() : 0;
                if (modules) {
                    const size = modules * Math.max(3, Math.floor(QR_BASE_SIZE / modules));
                    if (size !== QR_BASE_SIZE) qr = new root.QRCodeStyling(buildQrConfig(url, size, iconSrc));
                    qrDrawSize = size;
                    qrSize = Math.max(QR_BASE_SIZE, size);
                }
                const blob = await withTimeout(qr.getRawData('png'), 8000, 'QR');
                const blobUrl = root.URL.createObjectURL(blob);
                qrImage = await loadImage(blobUrl).catch(() => null);
                root.URL.revokeObjectURL(blobUrl);
            } catch (_error) {
                qrImage = null;
            }
        }

        // La targeta creix per sota si el QR és gros (llistes llargues)
        const panelY = 880;
        const panelH = Math.max(440, qrSize + 60);
        const canvas = doc.createElement('canvas');
        canvas.width = CARD_WIDTH;
        canvas.height = panelY + panelH + 30;
        const ctx = canvas.getContext('2d');

        drawBackground(ctx, canvas.width, canvas.height);

        // Capçalera: icona + «Segueix!» + «Música en català»
        const margin = 70;
        if (icon) ctx.drawImage(icon, margin, 64, 150, 150);
        drawWordmark(ctx, margin + 176, 150, 76);
        ctx.font = `600 26px ${SANS_FONT}`;
        setSpacing(ctx, 9);
        ctx.fillStyle = COLORS.terracotta;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('MÚSICA EN CATALÀ', margin + 180, 200);

        // Adhesiu amb el tipus («Ràdio» / «Llista de reproducció»), inclinat i amb ombra dura
        ctx.save();
        ctx.translate(margin, 316);
        ctx.rotate((-3 * Math.PI) / 180);
        ctx.font = `900 46px ${SANS_FONT}`;
        setSpacing(ctx, 4);
        const label = model.kindLabel.toUpperCase();
        const labelWidth = ctx.measureText(label).width;
        const pillW = labelWidth + 76;
        const pillH = 86;
        ctx.fillStyle = COLORS.terracotta;
        roundRect(ctx, 10, 10, pillW, pillH, 16);
        ctx.fill();
        ctx.fillStyle = COLORS.accent;
        roundRect(ctx, 0, 0, pillW, pillH, 16);
        ctx.fill();
        ctx.fillStyle = COLORS.bg;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 38, pillH / 2 + 2);
        ctx.restore();

        // Nom: Fraunces gran, fins a tres línies
        const maxTextWidth = CARD_WIDTH - margin * 2;
        const fit = fitLines(
            size => {
                ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
                setSpacing(ctx, 0);
                return text => ctx.measureText(text).width;
            },
            model.name,
            maxTextWidth,
            3,
            [124, 108, 92, 80, 68]
        );
        ctx.font = `700 ${fit.size}px ${DISPLAY_FONT}`;
        setSpacing(ctx, 0);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const lineHeight = Math.round(fit.size * 1.06);
        // El bloc nom + nombre de cançons es centra entre l'adhesiu i la targeta del QR
        const firstBaseline = fit.size * 0.8;
        const lastOffset = firstBaseline + (fit.lines.length - 1) * lineHeight;
        const blockHeight = lastOffset + (model.countText ? 72 : 0);
        const top = Math.max(430, 420 + (430 - blockHeight) / 2);
        let y = top + firstBaseline;
        for (const line of fit.lines) {
            ctx.fillText(line, margin, y);
            y += lineHeight;
        }

        if (model.countText) {
            ctx.font = `700 34px ${SANS_FONT}`;
            setSpacing(ctx, 1);
            ctx.fillStyle = COLORS.muted;
            ctx.fillText(model.countText.toUpperCase(), margin, top + lastOffset + 64);
        }

        // Targeta crema amb el QR i la crida
        const panelX = margin - 10;
        const panelW = CARD_WIDTH - panelX * 2;
        ctx.fillStyle = COLORS.terracotta;
        roundRect(ctx, panelX + 12, panelY + 12, panelW, panelH, 44);
        ctx.fill();
        ctx.fillStyle = COLORS.text;
        roundRect(ctx, panelX, panelY, panelW, panelH, 44);
        ctx.fill();

        const qrX = panelX + 30;
        const qrY = panelY + (panelH - qrSize) / 2;
        if (qrImage) {
            const offset = Math.round((qrSize - qrDrawSize) / 2);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(qrImage, qrX + offset, qrY + offset, qrDrawSize, qrDrawSize);
            ctx.imageSmoothingEnabled = true;
        } else if (icon) {
            ctx.drawImage(icon, qrX + 40, qrY + 40, qrSize - 80, qrSize - 80);
        }

        const textX = qrX + qrSize + 40;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = COLORS.terracottaDark;
        ctx.font = `900 28px ${SANS_FONT}`;
        setSpacing(ctx, 6);
        ctx.fillText('ESCANEJA', textX, qrY + 100);
        ctx.fillStyle = COLORS.bg;
        ctx.font = `700 60px ${DISPLAY_FONT}`;
        setSpacing(ctx, 0);
        const cta = qrImage ? ['i escolta-ho', 'amb Segueix!'] : ['Escolta-ho', 'amb Segueix!'];
        ctx.fillText(cta[0], textX, qrY + 182);
        ctx.fillText(cta[1], textX, qrY + 252);
        ctx.fillStyle = COLORS.terracottaDark;
        ctx.font = `700 26px ${SANS_FONT}`;
        setSpacing(ctx, 1);
        ctx.fillText('Música en català', textX, qrY + 308);

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => (blob ? resolve(blob) : reject(new Error('No s’ha pogut generar la imatge'))),
                'image/png'
            );
        });
    }

    // Comparteix la imatge (sense cap text ni enllaç) amb el menú nadiu. Retorna 'shared' | 'cancelled' | 'unsupported'.
    async function shareImage(blob, model) {
        const nav = root.navigator;
        if (!nav?.share || typeof root.File !== 'function') return 'unsupported';
        const file = new root.File([blob], model.fileName, { type: 'image/png' });
        if (typeof nav.canShare === 'function' && !nav.canShare({ files: [file] })) return 'unsupported';
        try {
            await nav.share({ files: [file], title: model.caption });
            return 'shared';
        } catch (error) {
            return error?.name === 'AbortError' ? 'cancelled' : 'unsupported';
        }
    }

    function downloadBlob(blob, fileName) {
        const doc = root.document;
        const href = root.URL.createObjectURL(blob);
        const link = doc.createElement('a');
        link.href = href;
        link.download = fileName;
        doc.body.appendChild(link);
        link.click();
        doc.body.removeChild(link);
        setTimeout(() => root.URL.revokeObjectURL(href), 1000);
    }

    return {
        COLORS,
        CARD_WIDTH,
        CARD_HEIGHT,
        ICON_URL,
        buildShareModel,
        countText,
        slugify,
        wrapLines,
        fitLines,
        qrSettings,
        canEncode,
        MAX_QR_URL_LENGTH,
        buildQrConfig,
        renderCard,
        shareImage,
        downloadBlob,
    };
});
