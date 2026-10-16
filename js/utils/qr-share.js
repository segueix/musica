// ==================== QR SHARE ====================
// Finestra del QR de compartició (Canal A): mostra la targeta de Segueix Música (icona, «Segueix!» com a l'obertura
// de l'app, tipus + nom i un QR amb la icona al centre) i deixa descarregar-la, compartir-la o copiar l'enllaç.
// La targeta la dibuixa js/utils/share-card.js (la mateixa imatge que es comparteix per WhatsApp).
// Depèn de: share-card.js i QRCodeStyling (qr-code-styling via CDN)

(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.utils = app.utils || {};

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function button(id, icon, label, style) {
        const node = el('button', 'hero-button');
        node.type = 'button';
        node.id = id;
        node.style.cssText = `font-size:0.9rem; ${style || ''}`;
        node.innerHTML = `<i data-lucide="${icon}"></i> <span></span>`;
        node.querySelector('span').textContent = label;
        return node;
    }

    // Genera el QR i mostra el modal amb la targeta
    // options: { type: 'radio'|'playlist'|'category'|'history', name, url, count }
    function showQrModal(options) {
        const { type, name, url, count } = options;
        const card = app.utils.shareCard;

        if (!card) {
            alert('La llibreria de QR no està disponible. Comprova la connexió.');
            return;
        }

        const model = card.buildShareModel({ type, name, count });

        const modal = el('div', 'modal-overlay active');
        modal.id = 'qrShareModal';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title"></h2>
                    <button class="modal-close" type="button" aria-label="Tanca"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body qr-share-body" style="text-align:center; padding: 12px 20px 20px;">
                    <div class="qr-share-preview" style="min-height:240px; display:grid; place-items:center;">
                        <p class="qr-share-wait" style="opacity:0.7;">Preparant la imatge…</p>
                    </div>
                    <div class="qr-share-actions" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:16px;"></div>
                </div>
            </div>
        `;
        modal.querySelector('.modal-title').textContent = `${model.kindLabel} · ${model.name}`;
        document.body.appendChild(modal);

        const close = () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            modal.remove();
        };
        modal.querySelector('.modal-close').addEventListener('click', close);
        modal.addEventListener('click', event => {
            if (event.target === modal) close();
        });

        let previewUrl = '';
        let cardBlob = null;
        const actions = modal.querySelector('.qr-share-actions');

        const download = button(
            'qrDownloadPng',
            'download',
            'Descarrega la imatge',
            'background:var(--color-button-accent); color:#ffffff;'
        );
        const share = button(
            'qrSharePng',
            'share-2',
            'Comparteix la imatge',
            'background:var(--color-button-accent); color:#ffffff;'
        );
        const copy = button('qrCopyLink', 'copy', 'Copia l’enllaç', 'background:#ffffff; color:#141615;');
        actions.append(download, share, copy);
        download.disabled = true;
        share.disabled = true;

        copy.addEventListener('click', () => {
            navigator.clipboard.writeText(url).then(() => {
                copy.innerHTML = '<i data-lucide="check"></i> <span>Copiat!</span>';
                copy.style.background = '#2ecc71';
                copy.style.color = '#fff';
                if (typeof refreshIcons === 'function') refreshIcons(copy);
            });
        });
        download.addEventListener('click', () => {
            if (cardBlob) card.downloadBlob(cardBlob, model.fileName);
        });
        share.addEventListener('click', async () => {
            if (!cardBlob) return;
            const result = await card.shareImage(cardBlob, model);
            if (result === 'unsupported') card.downloadBlob(cardBlob, model.fileName);
        });

        if (typeof refreshIcons === 'function') refreshIcons(modal);

        card.renderCard(model, url)
            .then(blob => {
                cardBlob = blob;
                previewUrl = URL.createObjectURL(blob);
                const preview = modal.querySelector('.qr-share-preview');
                const image = el('img');
                image.id = 'qrShareCard';
                image.alt = `Targeta de ${model.kindLabel.toLowerCase()} «${model.name}» amb un QR per obrir-la`;
                image.src = previewUrl;
                image.style.cssText = 'width:100%; max-width:340px; height:auto; border-radius:16px; display:block;';
                preview.replaceChildren(image);
                download.disabled = false;
                share.disabled = false;
            })
            .catch(error => {
                console.error('[qr-share] No s’ha pogut generar la targeta:', error);
                const wait = modal.querySelector('.qr-share-wait');
                if (wait) wait.textContent = 'No s’ha pogut generar la imatge.';
            });
    }

    app.utils.qrShare = {
        showQrModal,
    };
})(window);

