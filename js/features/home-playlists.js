// Llistes de reproducció de l'usuari a la part inferior de la pàgina principal.
// Implementació directa: llegeix les llistes de SegueixApp.features.library i les
// repinta quan canvien (esdeveniment segueix:playlists-changed) o quan es torna a
// renderitzar el feed.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const MAX_LISTS = 20;
    let container = null;
    let renderTimer = null;

    function escapeText(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    function coverMarkup(videos) {
        const thumbs = videos.map(video => video?.thumbnail).filter(Boolean);
        if (thumbs.length >= 4) {
            return `<span class="hp-mosaic">${thumbs
                .slice(0, 4)
                .map(src => `<img src="${escapeText(src)}" alt="" loading="lazy" decoding="async">`)
                .join('')}</span>`;
        }
        const src = thumbs[0] || 'img/icon-512.png';
        return `<img class="hp-single" src="${escapeText(src)}" alt="" loading="lazy" decoding="async">`;
    }

    function addCardMarkup() {
        return `
            <div class="hp-add" data-hp-add-wrap>
                <button type="button" class="hp-add-btn" data-hp-add aria-label="Crea una llista nova">
                    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
                </button>
                <span class="hp-add-label">Nova llista</span>
            </div>`;
    }

    function render() {
        container = container || document.getElementById('homePlaylists');
        if (!container) return;
        const playlists = (app.features.library?.getPlaylists?.() || []).filter(
            list => list && Array.isArray(list.videos)
        );
        container.classList.remove('hidden');
        container.innerHTML = `
            <header class="home-section-header">
                <div class="home-section-heading">
                    <h2 class="home-section-title">Les teves llistes</h2>
                    <span class="home-section-subtitle">Biblioteca</span>
                </div>
                ${playlists.length ? '<div class="home-section-controls"><button type="button" class="home-section-more" data-hp-all>Veure-ho tot</button></div>' : ''}
            </header>
            <div class="home-section-row hp-row">
                ${playlists
                    .slice(0, MAX_LISTS)
                    .map(
                        list => `
                    <button type="button" class="hp-card" data-hp-play="${escapeText(list.id)}" data-hp-count="${list.videos.length}" aria-label="Reprodueix ${escapeText(list.name)}">
                        <span class="hp-cover">
                            ${coverMarkup(list.videos)}
                            <span class="hp-play" aria-hidden="true"></span>
                        </span>
                        <span class="hp-name">${escapeText(list.name || 'Llista')}</span>
                        <span class="hp-meta">${list.videos.length} ${list.videos.length === 1 ? 'cançó' : 'cançons'}</span>
                    </button>`
                    )
                    .join('')}
                ${addCardMarkup()}
            </div>
        `;
    }

    function openCreateForm(wrap) {
        wrap.innerHTML = `
            <form class="hp-add-form" data-hp-form>
                <input class="hp-add-input" type="text" maxlength="60" placeholder="Nom de la llista" aria-label="Nom de la nova llista" autocomplete="off">
                <button type="submit" class="hp-add-ok">Crea</button>
            </form>`;
        const input = wrap.querySelector('input');
        input.focus();
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') render();
        });
        wrap.querySelector('form').addEventListener('submit', event => {
            event.preventDefault();
            const name = input.value.trim();
            if (!name || typeof createPlaylist !== 'function') return render();
            createPlaylist(name); // desa i dispara segueix:playlists-changed
            render();
        });
    }

    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => {
            // No trepitgem el formulari de nova llista si l'usuari l'està escrivint.
            if (container?.querySelector('[data-hp-form] input:focus')) return;
            render();
        }, 60);
    }

    function onClick(event) {
        const add = event.target.closest('[data-hp-add]');
        if (add) {
            openCreateForm(add.closest('[data-hp-add-wrap]'));
            return;
        }
        const play = event.target.closest('[data-hp-play]');
        if (play) {
            // Una llista buida no té res per reproduir: portem l'usuari a la Biblioteca.
            if (play.dataset.hpCount === '0') {
                document.querySelector('.nav-trigger[data-page="llistes"]')?.click();
            } else if (typeof startPlaylistPlayback === 'function') startPlaylistPlayback(play.dataset.hpPlay);
            return;
        }
        if (event.target.closest('[data-hp-all]')) {
            document.querySelector('.nav-trigger[data-page="llistes"]')?.click();
        }
    }

    function init() {
        container = document.getElementById('homePlaylists');
        if (!container) return;
        container.addEventListener('click', onClick);
        window.addEventListener('segueix:playlists-changed', scheduleRender);
        window.addEventListener('storage', scheduleRender);
        // El feed es repinta en canviar de categoria: en aquest moment refresquem també les llistes.
        const grid = document.getElementById('videosGrid');
        if (grid && typeof MutationObserver === 'function') {
            new MutationObserver(scheduleRender).observe(grid, { childList: true });
        }
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    app.features.homePlaylists = { render };
})(window);
