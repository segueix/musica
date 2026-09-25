// ==================== QR SHARE ====================
// Generació de QR visuals per a compartició ràpida (Canal A)
// Depèn de: QRCodeStyling (qr-code-styling via CDN), share-codecs.js
//
// Ordre visual: capçalera SEGUEIX! → subtítol (tipus: nom) → QR → botons

(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.utils = app.utils || {};

    const BRAND_SUBTITLE = 'Els nostres YouTubers';

    // Logo SVG oficial integrat al centre (Cor negre + Play blanc sobre cercle blanc)
    const LOGO_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTkyIDE5MiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiI+PGNpcmNsZSBjeD0iOTYiIGN5PSI5NiIgcj0iOTYiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTk2IDE2OCBDOTYgMTY4IDIwIDExOCAyMCA2OCBDMjAgNDMgNDAgMjYgNjIgMjYgQzc1IDI2IDg2IDMzIDk2IDQzIEMxMDYgMzMgMTE3IDI2IDEzMCAyNiBDMTUyIDI2IDE3MiA0MyAxNzIgNjggQzE3MiAxMTggOTYgMTY4IDk2IDE2OFoiIGZpbGw9ImJsYWNrIi8+PHBvbHlnb24gcG9pbnRzPSI3OCw3NiA3OCwxMzIgMTMyLDEwNCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=';

    // Mapa de tipus a etiqueta
    const TYPE_LABELS = {
        playlist: 'Llista',
        category: 'Categoria',
        history: 'Visualitzacions',
    };

    // Resolució del QR per pantalla i per PNG
    const QR_SCREEN_SIZE = 280;
    const QR_PNG_SIZE = 800;
    const PNG_SCALE = 3; // Factor d'escala per alta resolució

    // Crea la configuració base del QR
    function _createQrConfig(url, size) {
        return {
            width: size,
            height: size,
            data: url,
            type: 'canvas',

            // INTEGRACIÓ DEL LOGO AL CENTRE
            image: LOGO_BASE64,
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: 0, // Sense marge — el cercle blanc toca directament els dots
                imageSize: 0.28 // Mida 28% del QR (segura amb errorcorrection H)
            },

            // ESTIL DELS PÍXELS (DOTS) - Estil 'classy' per lligar amb corbes i rectes del logo
            dotsOptions: {
                color: '#ffffff',
                type: 'classy',
            },

            // ESTIL DE LES CANTONADES - Arrodonides i netes
            cornersSquareOptions: {
                color: '#ffffff',
                type: 'extra-rounded',
            },
            cornersDotOptions: {
                color: '#ffffff',
                type: 'dot',
            },

            // ALTRES PARÀMETRES
            backgroundOptions: {
                color: '#1a1a2e', // El fons fosc de l'app
            },
            qrOptions: {
                errorCorrectionLevel: 'H', // Obligatori per usar logo!
            },
        };
    }

    // Genera el QR i mostra el modal amb branding
    function showQrModal(options) {
        const { type, name, url } = options;
        const typeLabel = TYPE_LABELS[type] || type;

        if (typeof QRCodeStyling === 'undefined') {
            alert('La llibreria de QR no està disponible. Comprova la connexió.');
            return;
        }

        // QR per pantalla
        const qrCode = new QRCodeStyling(_createQrConfig(url, QR_SCREEN_SIZE));

        // Crear el modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'qrShareModal';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header" style="text-align:center; padding:20px 20px 0;">
                    <h2 class="modal-title" style="justify-content:center;">
                        <span style="display:inline-flex; align-items:center; gap:0; line-height:1;"><span style="color:#ffffff; font-weight:900;">SEGUEIX</span><span style="color:#e94560; font-weight:900; margin-left:-0.05em;">!</span></span>
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align:center; padding: 10px 20px 20px;">
                    <p style="font-size:0.75rem; opacity:0.5; margin-bottom:8px;">${BRAND_SUBTITLE}</p>
                    <p style="font-size:1rem; font-weight:600; margin-bottom:16px;">${escapeHtml(typeLabel)}: ${escapeHtml(name)}</p>
                    <div id="qrShareCanvas" style="display:inline-block; background:#1a1a2e; padding:16px; border-radius:12px; margin-bottom:16px;"></div>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="hero-button" id="qrDownloadPng" style="font-size:0.85rem; background:var(--color-button-accent); color:#ffffff;">
                            <i data-lucide="download"></i> Descarregar imatge
                        </button>
                        <button class="hero-button" id="qrCopyLink" style="font-size:0.85rem; background:#ffffff; color:#1a1a2e;">
                            <i data-lucide="copy"></i> Copiar enllaç
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Renderitzar el QR dins el contenidor
        const canvasContainer = modal.querySelector('#qrShareCanvas');
        qrCode.append(canvasContainer);

        // Botó descarregar PNG — generem una imatge composta amb branding a alta resolució
        modal.querySelector('#qrDownloadPng').addEventListener('click', function () {
            _downloadQrAsPng(url, typeLabel, name);
        });

        // Botó copiar enllaç
        modal.querySelector('#qrCopyLink').addEventListener('click', function () {
            navigator.clipboard.writeText(url).then(function () {
                const btn = modal.querySelector('#qrCopyLink');
                btn.innerHTML = '<i data-lucide="check"></i> Copiat!';
                btn.style.background = '#2ecc71';
                btn.style.color = '#fff';
                if (typeof refreshIcons === 'function') refreshIcons(btn);
            });
        });

        // Tancar clicant fora
        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.remove();
        });

        if (typeof refreshIcons === 'function') refreshIcons(modal);
    }

    // Genera una imatge PNG d'alta resolució amb capçalera + QR
    function _downloadQrAsPng(url, typeLabel, name) {
        // Generem un QR a alta resolució per al PNG
        const qrHiRes = new QRCodeStyling(_createQrConfig(url, QR_PNG_SIZE));

        qrHiRes.getRawData('png').then(function (blob) {
            const img = new Image();
            img.onload = function () {
                var padding = 60 * PNG_SCALE;
                var headerHeight = 160 * PNG_SCALE;
                var footerHeight = 20 * PNG_SCALE;
                var canvasWidth = img.width + padding * 2;
                var canvasHeight = img.height + padding * 2 + headerHeight + footerHeight;

                var canvas = document.createElement('canvas');
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                var ctx = canvas.getContext('2d');

                // Fons
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);

                // SEGUEIX en blanc, ! en vermell — alta resolució
                var titleY = padding + 50 * PNG_SCALE;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                var titleFontSize = 48 * PNG_SCALE;
                ctx.font = '900 ' + titleFontSize + 'px Roboto, Arial, sans-serif';

                // Mesurar "SEGUEIX" per posicionar el "!"
                var segueixText = 'SEGUEIX';
                var exclamText = '!';
                var segueixWidth = ctx.measureText(segueixText).width;
                var exclamWidth = ctx.measureText(exclamText).width;
                var totalWidth = segueixWidth + exclamWidth;
                var startX = (canvasWidth - totalWidth) / 2;
                var exclamOffset = 0.05 * titleFontSize;

                ctx.fillStyle = '#ffffff';
                ctx.fillText(segueixText, startX + segueixWidth / 2, titleY);

                ctx.fillStyle = '#e94560';
                ctx.fillText(exclamText, startX + segueixWidth + exclamWidth / 2 - exclamOffset, titleY);

                // Subtítol
                var subtitleY = titleY + 40 * PNG_SCALE;
                ctx.fillStyle = '#cccccc';
                ctx.font = (20 * PNG_SCALE) + 'px Roboto, Arial, sans-serif';
                ctx.fillText(BRAND_SUBTITLE, canvasWidth / 2, subtitleY);

                // Tipus: Nom
                var typeY = subtitleY + 35 * PNG_SCALE;
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold ' + (24 * PNG_SCALE) + 'px Roboto, Arial, sans-serif';
                ctx.fillText(typeLabel + ': ' + name, canvasWidth / 2, typeY);

                // QR
                ctx.drawImage(img, padding, padding + headerHeight);

                // Descarregar
                canvas.toBlob(function (pngBlob) {
                    var dlUrl = URL.createObjectURL(pngBlob);
                    var a = document.createElement('a');
                    a.href = dlUrl;
                    a.download = 'segueix-' + typeLabel.toLowerCase() + '-' + name.replace(/[^a-zA-Z0-9àáèéíòóúü]/g, '_').substring(0, 30) + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(dlUrl);
                }, 'image/png');
            };
            img.src = URL.createObjectURL(blob);
        });
    }

    app.utils.qrShare = {
        showQrModal,
    };
})(window);
