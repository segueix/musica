(function (window) {
    const app = window.SegueixApp;
    // Les dues vistes de Descobreix només es descarreguen quan se’n demana show().
    // Conserva la interfície síncrona de navegació i una única petició per mòdul.
    for (const [name, file] of [
        ['artistMap', 'js/features/artist-map.js?v=20261017-dibuixa-esquerra'],
        ['affinity', 'js/features/affinity.js?v=20261016-afinitat-foto'],
    ]) {
        let pending, container, visible = false, restore = false, revision = 0;
        const ensure = () => {
            if (pending) return pending;
            pending = new Promise((resolve, reject) => {
                const script = window.document.createElement('script');
                script.src = window.appDataUrl(file);
                script.onload = () => {
                    if (app.features[name] === proxy) {
                        pending = null;
                        script.remove();
                        reject(new Error('El mòdul no s’ha inicialitzat'));
                    } else resolve(app.features[name]);
                };
                script.onerror = () => {
                    pending = null;
                    script.remove();
                    reject(new Error('No s’ha pogut carregar Descobreix'));
                };
                window.document.head.appendChild(script);
            });
            return pending;
        };
        const proxy = {
            show(target) {
                const current = ++revision;
                container = target;
                visible = true;
                target.classList.remove('hidden');
                target.textContent = 'Carregant…';
                return ensure().then(feature => {
                    // Una navegació durant la descàrrega no ha de reobrir la vista.
                    if (!visible || current !== revision || container.classList.contains('hidden')) return;
                    if (restore) { feature.restoreReturn?.(); restore = false; }
                    return feature.show(container);
                }).catch(() => {
                    if (!visible || current !== revision) return;
                    container.textContent = 'No s’ha pogut carregar. ';
                    const retry = window.document.createElement('button');
                    retry.type = 'button';
                    retry.textContent = 'Torna-ho a provar';
                    retry.addEventListener('click', () => proxy.show(container));
                    container.appendChild(retry);
                });
            },
            hide(target) {
                revision++;
                visible = false;
                restore = false;
                (target || container)?.classList.add('hidden');
            },
            restoreReturn() { restore = true; },
        };
        app.features[name] = proxy;
    }
})(window);
