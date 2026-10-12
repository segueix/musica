// «Per afinitat» (vista Descobreix): «Si t'agrada X, prova Y». A partir dels artistes que l'usuari escolta, li agraden
// o segueix, proposa artistes que encara no coneix i que comparteixen estil i època, amb una frase que diu el perquè
// («Perquè escoltes Els Catarres»). Sense cap rastre de gust, mostra els estils per començar.
// Implementació directa (patró 2). El model (buildModel) i l'HTML són purs: tests/affinity.test.js.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const MAX_CARDS = 8;
    const PER_SEED = 2;
    const MAX_SEEDS = 6;
    const FALLBACK_AVATAR = 'img/icon-192.png';
    // Pes de cada senyal per triar els artistes «llavor» (com recentTaste de discovery.js)
    const POINTS = { play: 1, like: 2, follow: 3 };

    const esc = value =>
        String(value ?? '').replace(
            /[&<>"']/g,
            c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
        );
    const lower = value =>
        String(value || '')
            .trim()
            .toLowerCase();
    // { year, original }: l'any original si el feed el sap; si no, el de pujada a YouTube
    const yearOf = video => {
        const original = Number(video?.originalYear);
        if (original > 1900) return { year: original, original: true };
        const year = new Date(video?.publishedAt || 0).getFullYear();
        return year > 1900 ? { year, original: false } : null;
    };
    // Abans del 2013 molts grups pujaven discos antics: l'any de pujada no diu l'època
    const UPLOAD_ERA_FROM = 2013;

    // ---------- Model (pur) ----------

    // Any de referència de cada artista: el desè percentil dels anys de les seves cançons (any original si se sap).
    // Així un grup dels 90 amb reedicions recents queda als 90, i un d'actual no baixa per una versió antiga.
    // → Map(grup → { year, sure }): `sure` si l'any és original o de pujada recent; si no, només serveix per comparar
    // (no es mostra cap «Dels 00» que podria ser fals).
    function artistYears(videos, channelOfGroup) {
        const years = new Map();
        (Array.isArray(videos) ? videos : []).forEach(video => {
            const group = channelOfGroup.get(lower(video?.channelId));
            const year = yearOf(video);
            if (!group || !year) return;
            if (!years.has(group)) years.set(group, []);
            years.get(group).push(year);
        });
        const result = new Map();
        years.forEach((list, group) => {
            list.sort((a, b) => a.year - b.year);
            const pick = list[Math.floor((list.length - 1) * 0.1)];
            result.set(group, { year: pick.year, sure: pick.original || pick.year >= UPLOAD_ERA_FROM });
        });
        return result;
    }

    const decadeLabel = year => {
        if (!year) return '';
        const decade = Math.floor(year / 10) * 10;
        return decade >= 2020 ? 'D’ara' : `Dels ${String(decade).slice(2)}`;
    };

    // Semblança entre dos artistes: estils compartits (el principal compta més), gèneres compartits i època.
    function similarity(a, b) {
        const shared = a.styles.filter(style => b.styles.includes(style));
        if (!shared.length) return { score: 0, shared };
        const genres = a.genres.filter(genre => b.genres.includes(genre)).length;
        let score = shared.length + genres * 0.5;
        if (a.primary && a.primary === b.primary) score += 2;
        if (a.year && b.year) score += Math.max(0, 1 - Math.abs(a.year - b.year) / 15) * 3;
        return { score, shared: a.primary && shared.includes(a.primary) ? [a.primary] : shared };
    }

    // artists: [{ id, name, avatar, channelIds, styles, primary, genres, year, views }]
    // taste: { history, liked, followedIds } (les dades de discovery.readAppContext()); hiddenIds: canals amagats.
    // → { hasTaste, cards: [{ seed, artist, reason, style, era }] }
    function buildModel({ artists = [], taste = {}, hiddenIds = [], max = MAX_CARDS } = {}) {
        const hidden = new Set((hiddenIds || []).map(lower));
        const list = (Array.isArray(artists) ? artists : []).filter(
            artist => artist?.id && !artist.channelIds.every(id => hidden.has(lower(id)))
        );
        const byChannel = new Map();
        list.forEach(artist => artist.channelIds.forEach(id => byChannel.set(lower(id), artist)));

        // Artistes que l'usuari coneix i per què (el senyal que més pesa dona la frase)
        const known = new Map();
        const add = (channelId, kind) => {
            const artist = byChannel.get(lower(channelId));
            if (!artist) return;
            const entry = known.get(artist.id) || { artist, points: 0, kinds: {} };
            entry.points += POINTS[kind];
            entry.kinds[kind] = (entry.kinds[kind] || 0) + POINTS[kind];
            known.set(artist.id, entry);
        };
        (taste.history || []).forEach(video => video && !video.isShort && add(video.channelId, 'play'));
        (taste.liked || []).forEach(video => video && add(video.channelId, 'like'));
        (taste.followedIds || []).forEach(id => add(id, 'follow'));
        if (!known.size) return { hasTaste: false, cards: [] };

        const seeds = [...known.values()]
            .sort((a, b) => b.points - a.points || a.artist.name.localeCompare(b.artist.name, 'ca'))
            .slice(0, MAX_SEEDS);
        const used = new Set();
        const perSeed = seeds.map(seed => {
            const options = list
                .filter(candidate => !known.has(candidate.id))
                .map(candidate => ({ candidate, ...similarity(seed.artist, candidate) }))
                .filter(option => option.score > 0)
                .sort(
                    (a, b) =>
                        b.score - a.score ||
                        (b.candidate.views || 0) - (a.candidate.views || 0) ||
                        a.candidate.name.localeCompare(b.candidate.name, 'ca')
                );
            return { seed, options };
        });
        // Per torns: la millor proposta de cada artista llavor, després la segona…, sense repetir artistes
        const cards = [];
        for (let round = 0; round < PER_SEED && cards.length < max; round++) {
            perSeed.forEach(({ seed, options }) => {
                if (cards.length >= max) return;
                const option = options.find(item => !used.has(item.candidate.id));
                if (!option) return;
                used.add(option.candidate.id);
                const kind = ['follow', 'like', 'play'].sort((a, b) => (seed.kinds[b] || 0) - (seed.kinds[a] || 0))[0];
                const verb = { follow: 'segueixes', like: 't’agrada', play: 'escoltes' }[kind];
                cards.push({
                    seed: { id: seed.artist.id, name: seed.artist.name },
                    artist: option.candidate,
                    reason: `Perquè ${verb} ${seed.artist.name}`,
                    style: option.shared[0] || '',
                    era: option.candidate.yearSure === false ? '' : decadeLabel(option.candidate.year),
                });
            });
        }
        return { hasTaste: true, cards };
    }

    // ---------- HTML (pur) ----------

    const PLAY =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>';

    function cardHtml(card) {
        const artist = card.artist;
        const chips = [card.style, card.era]
            .filter(Boolean)
            .map(text => `<span class="af-chip">${esc(text)}</span>`)
            .join('');
        return `<li class="af-card">
            <button type="button" class="af-card__main" data-af-artist="${esc(artist.id)}">
                <img class="af-card__avatar" src="${esc(artist.avatar || FALLBACK_AVATAR)}" alt="" loading="lazy" decoding="async" width="88" height="88">
                <span class="af-card__lead">Si t’agrada <strong>${esc(card.seed.name)}</strong>, prova</span>
                <span class="af-card__name">${esc(artist.name)}</span>
                <span class="af-card__why">${esc(card.reason)}</span>
                <span class="af-card__chips">${chips}</span>
            </button>
            <button type="button" class="af-card__play" data-af-play="${esc(artist.id)}" aria-label="Escolta ${esc(artist.name)}">${PLAY}<span>Escolta</span></button>
        </li>`;
    }

    // styles: [{ name, count }] per a l'usuari sense historial
    function html(model, { styles = [] } = {}) {
        const head = `<div class="af-head"><h2 class="af-title">Per afinitat</h2>`;
        if (!model.hasTaste || !model.cards.length) {
            const chips = styles
                .map(
                    style =>
                        `<button type="button" class="af-style" data-af-style="${esc(style.name)}"><span>${esc(style.name)}</span>${style.count ? `<small>${style.count} artistes</small>` : ''}</button>`
                )
                .join('');
            const text = model.hasTaste
                ? 'Encara no hem trobat artistes semblants als que escoltes. Mentrestant, tria un estil:'
                : 'Quan escoltis o segueixis artistes, aquí et proposarem grups semblants que encara no coneixes. Per començar, tria un estil:';
            return `${head}<p class="af-sub">${text}</p></div><div class="af-styles">${chips}</div>`;
        }
        return `${head}<p class="af-sub">Artistes que encara no coneixes, del mateix estil i època que els que escoltes.</p></div>
            <ul class="af-list">${model.cards.map(cardHtml).join('')}</ul>`;
    }

    // ---------- DOM ----------

    const state = { container: null, bound: false, signature: '', artists: new Map(), songs: new Map() };

    function youtubeApi() {
        return typeof YouTubeAPI !== 'undefined' ? YouTubeAPI : window.YouTubeAPI;
    }

    function readTaste() {
        const discovery = app.features.discovery;
        try {
            return discovery?.readAppContext?.() || {};
        } catch (_error) {
            return {};
        }
    }

    function hiddenChannels() {
        return typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : [];
    }

    // Artistes de l'app amb estils, gèneres, any de referència i visualitzacions
    function collectArtists(videos) {
        const music = window.SegueixMusicCategories;
        const groups = youtubeApi()?.getArtistGroups?.() || [];
        const channelOfGroup = new Map();
        groups.forEach(group =>
            (group.channelIds || [group.id]).forEach(id => channelOfGroup.set(lower(id), String(group.id)))
        );
        const years = artistYears(videos, channelOfGroup);
        const views = new Map();
        const songs = new Map();
        (videos || []).forEach(video => {
            const group = channelOfGroup.get(lower(video?.channelId));
            if (!group) return;
            views.set(group, (views.get(group) || 0) + (Number(video.viewCount) || 0));
            if (!songs.has(group)) songs.set(group, []);
            songs.get(group).push(video);
        });
        const artists = groups
            .filter(group => songs.has(String(group.id)))
            .map(group => {
                const ids = (group.channelIds || [group.id]).map(String);
                const styles = [...new Set(ids.flatMap(id => music?.categoriesForChannel?.(id) || []))];
                return {
                    id: String(group.id),
                    name: group.name,
                    avatar: group.avatar || group.thumbnail || '',
                    channelIds: ids,
                    styles,
                    primary: ids.map(id => music?.primaryCategoryForChannel?.(id)).find(Boolean) || styles[0] || '',
                    genres: (group.categories || []).map(lower),
                    year: years.get(String(group.id))?.year || null,
                    yearSure: Boolean(years.get(String(group.id))?.sure),
                    views: views.get(String(group.id)) || 0,
                };
            });
        return { artists, songs };
    }

    function styleList(artists) {
        const music = window.SegueixMusicCategories;
        const counts = new Map();
        artists.forEach(artist => artist.primary && counts.set(artist.primary, (counts.get(artist.primary) || 0) + 1));
        const order = (music?.CATEGORY_GROUPS || []).map(group => group.name || group.label || group).filter(Boolean);
        const names = order.length ? order.filter(name => counts.has(name)) : [...counts.keys()];
        return names.slice(0, 12).map(name => ({ name, count: counts.get(name) || 0 }));
    }

    async function loadSongs() {
        const youtube = youtubeApi();
        let history = [];
        try {
            history = (await youtube?.ensureStyleHistory?.()) || [];
        } catch (_error) {
            history = [];
        }
        const all = [...(youtube?.feedVideos || []), ...history];
        return youtube?.filterHiddenVideos ? youtube.filterHiddenVideos(all) : all;
    }

    function onClick(event) {
        const play = event.target.closest?.('[data-af-play]');
        if (play) {
            const artist = state.artists.get(play.dataset.afPlay);
            const songs = state.songs.get(play.dataset.afPlay) || [];
            const ok = app.features.musicQueue?.startArtistRadio?.(songs, {
                name: artist?.name,
                channelId: artist?.id,
            });
            if (!ok) app.features.shellNav?.toast?.('No hi ha prou cançons d’aquest artista per fer-ne una ràdio.');
            return;
        }
        const main = event.target.closest?.('[data-af-artist]');
        if (main) {
            if (typeof openChannelProfile === 'function') openChannelProfile(main.dataset.afArtist);
            return;
        }
        const style = event.target.closest?.('[data-af-style]');
        if (style) app.features.shellNav?.openStyle?.(style.dataset.afStyle);
    }

    async function show(container) {
        if (!container) return;
        state.container = container;
        container.classList.remove('hidden');
        if (!state.bound) {
            state.bound = true;
            container.addEventListener('click', onClick);
            // Seguir o deixar de seguir un artista canvia les propostes
            window.addEventListener?.('segueix:music-prefs-changed', () => {
                if (!state.container?.classList.contains('hidden')) {
                    state.signature = '';
                    show(state.container);
                }
            });
        }
        if (!container.children.length) container.innerHTML = '<p class="af-loading">Buscant artistes per a tu…</p>';
        // Descobreix es torna a pintar sovint: només es recalcula si ha canviat el gust o els artistes de l'app
        const taste = readTaste();
        const signature = [
            (taste.history || []).length,
            taste.history?.[0]?.id || '',
            (taste.liked || []).length,
            (taste.followedIds || []).length,
            hiddenChannels().length,
            (youtubeApi()?.getArtistGroups?.() || []).length,
        ].join('|');
        if (signature === state.signature && container.querySelector('.af-head')) return;
        state.signature = signature;
        render();
    }

    let renderId = 0;
    async function render() {
        const id = ++renderId;
        const videos = await loadSongs();
        if (id !== renderId || !state.container || state.container.classList.contains('hidden')) return;
        const { artists, songs } = collectArtists(videos);
        state.artists = new Map(artists.map(artist => [artist.id, artist]));
        state.songs = songs;
        const model = buildModel({ artists, taste: readTaste(), hiddenIds: hiddenChannels() });
        state.container.innerHTML = html(model, { styles: styleList(artists) });
    }

    function hide(container) {
        const target = container || state.container;
        if (target) target.classList.add('hidden');
    }

    app.features.affinity = { buildModel, similarity, artistYears, decadeLabel, html, show, hide };
})(window);
