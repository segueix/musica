(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    // Nota: el sistema antic de ?list= (via Google Sheets) ha estat eliminat.
    // La compartició ràpida ara usa ?importData= (Canal A, share-codecs.js).
    // La recepció de ?list= mostra un missatge d'error informatiu.

    function getNavigationFeature() {
        return app.features?.navigation || null;
    }

    function getLibraryFeature() {
        return app.features?.library || null;
    }

    // Gestiona la detecció d'un ?list= antic (ara obsolet)
    // i la detecció del nou ?importData= (delegada a l'app principal)
    async function handleUrlImport() {
        const params = new URLSearchParams(window.location.search);

        if (params.has('list')) {
            // Paràmetre antic de Google Sheets — ja no funcional
            window.history.replaceState({}, document.title, window.location.pathname);

            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.id = 'importPlaylistModal';
            modal.style.zIndex = '10000';
            modal.innerHTML = `
                <div class="modal modal-small">
                    <div class="modal-header">
                        <h2 class="modal-title">Enllaç obsolet</h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <div class="modal-body" style="text-align:center; padding: 30px 20px;">
                        <p style="margin-bottom:15px;">Aquest enllaç és d'un sistema antic que ja no està actiu.</p>
                        <p style="margin-bottom:20px; font-size:0.9rem; opacity:0.7;">Els nous enllaços de compartició generen un URL amb <code>?importData=</code> que funciona sense servidor.</p>
                        <button class="hero-button" onclick="this.closest('.modal-overlay').remove()">D'acord</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            if (typeof refreshIcons === 'function') refreshIcons(modal);
        }
    }

    function renderSharedPlaylist(name, stringIds = '') {
        const ids = Array.isArray(stringIds)
            ? stringIds
            : (typeof stringIds === 'string' ? stringIds.split(',') : []);

        const allKnownVideos = [...(window.cachedAPIVideos || []), ...(window.VIDEOS || [])];

        const videos = ids.map(id => {
            return (
                allKnownVideos.find(v => String(v.id) === String(id)) || {
                    id: id,
                    title: 'Vídeo Carregant...',
                    thumbnail: 'img/icon-192.png',
                    channelTitle: '...',
                }
            );
        });

        const navigation = getNavigationFeature();
        navigation?.updatePageTitle?.(`Llista compartida: ${name}`);
        const chipsBarEl = document.querySelector('.chips-bar');
        if (chipsBarEl) chipsBarEl.classList.add('hidden');

        const container = document.getElementById('videosGrid');
        if (!container) return;

        const stringIdsEncoded = encodeURIComponent(JSON.stringify(ids));
        const headerHTML = `
            <div style="grid-column: 1 / -1; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#222; padding:15px; border-radius:10px;">
                <div>
                    <h2 style="margin:0; font-size:1.2rem;">📂 ${escapeHtml(name)}</h2>
                    <p style="margin:0; opacity:0.7;">${videos.length} vídeos compartits</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="saveImportedPlaylist('${escapeHtml(name)}', '${stringIdsEncoded}')" class="hero-button" style="padding:8px 16px; font-size:0.9rem;">
                        💾 Guardar a la meva Biblioteca
                    </button>
                    <a href="${window.location.pathname}" class="hero-button" style="background:#444; text-decoration:none; padding:8px 16px; font-size:0.9rem;">
                        Sortir
                    </a>
                </div>
            </div>
        `;

        const videosHTML = videos
            .map(v => (typeof createVideoCardAPI === 'function' ? createVideoCardAPI(v) : ''))
            .join('');

        container.innerHTML = headerHTML + videosHTML;

        container.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', () => {
                if (typeof showVideoFromAPI === 'function') showVideoFromAPI(card.dataset.videoId);
            });
        });
    }

    function saveImportedPlaylist(name, stringIdsEncoded = '') {
        let ids = [];
        try {
            ids = JSON.parse(decodeURIComponent(stringIdsEncoded));
        } catch (e) {
            ids = typeof stringIdsEncoded === 'string' ? stringIdsEncoded.split(',') : [];
        }

        const allKnownVideos = [...(window.cachedAPIVideos || []), ...(window.VIDEOS || [])];

        const resolvedVideos = ids.map(id => {
            const found = allKnownVideos.find(v => String(v.id) === String(id));
            if (found) return (getLibraryFeature()?.getPlaylistVideoData || getPlaylistVideoData)(found);
            return { id: id, title: 'Vídeo desconegut', source: 'api' };
        });

        const playlists = (getLibraryFeature()?.getPlaylists || getPlaylists)();
        const newPlaylist = {
            id: `pl_${Date.now()}`,
            name: `${name} (Importada)`,
            videos: resolvedVideos,
        };

        playlists.push(newPlaylist);
        (getLibraryFeature()?.savePlaylists || savePlaylists)(playlists);

        alert(`Llista "${newPlaylist.name}" guardada correctament a la Biblioteca!`);
    }

    app.features.sharedPlaylists = {
        handleUrlImport,
        renderSharedPlaylist,
        saveImportedPlaylist,
    };
})(window);
