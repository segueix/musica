// «La teva música»: Historial (les tres últimes cançons amb quan s'han escoltat i un símbol per expandir-lo per
// dates), Artistes (només els que segueixes) i, a sota, les llistes de reproducció (les pinta app.js).
// Implementació directa: model pur + HTML + esdeveniments. Sense categories intel·ligents ni programes.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const LATEST = 3;
    // Files de l'historial expandit; la resta es veu a la pàgina d'historial complet.
    const MAX_LIST = 50;
    const DAY = 86400000;
    const RANGES = [
        { id: 'week', label: 'Última setmana', days: 7 },
        { id: 'month', label: 'Últim mes', days: 30 },
        { id: 'quarter', label: 'Últims 3 mesos', days: 90 },
        { id: 'all', label: 'Tot l’historial', days: Infinity },
    ];
    const FALLBACK_AVATAR = 'img/icon-192.png';
    const MONTHS = [
        'gener',
        'febrer',
        'març',
        'abril',
        'maig',
        'juny',
        'juliol',
        'agost',
        'setembre',
        'octubre',
        'novembre',
        'desembre',
    ];
    const WEEKDAYS = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
    const CHEVRON =
        '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';

    // Estat de la interfície (sobreviu als repintats de la pàgina).
    const state = { expanded: false, range: '' };

    // ---------- Text i dates ----------

    function escapeHtml(value) {
        return String(value ?? '').replace(
            /[&<>"']/g,
            char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
        );
    }

    const startOfDay = time => {
        const date = new Date(time);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    };
    // Dies de calendari entre dues dates (robust davant els canvis d'hora).
    const dayDiff = (now, time) => Math.round((startOfDay(now) - startOfDay(time)) / DAY);

    // «12 de setembre» / «4 d'abril» (amb l'any si no és l'actual).
    function dateLabel(time, now) {
        const date = new Date(time);
        const month = MONTHS[date.getMonth()];
        const de = /^[aeiou]/.test(month) ? 'd’' : 'de ';
        const year = date.getFullYear() === new Date(now).getFullYear() ? '' : ` de ${date.getFullYear()}`;
        return `${date.getDate()} ${de}${month}${year}`;
    }

    // Quan s'ha escoltat: «Ara mateix», «Fa 12 min», «Fa 3 h», «Ahir», «Fa 4 dies» o la data.
    function formatWhen(time, now = Date.now()) {
        if (!Number.isFinite(time) || time <= 0) return '';
        const diff = now - time;
        if (diff < 45000) return 'Ara mateix';
        const days = dayDiff(now, time);
        if (days <= 0) {
            if (diff < 3600000) return `Fa ${Math.max(1, Math.round(diff / 60000))} min`;
            return `Fa ${Math.max(1, Math.floor(diff / 3600000))} h`;
        }
        if (days === 1) return 'Ahir';
        if (days < 7) return `Fa ${days} dies`;
        return dateLabel(time, now);
    }

    // Capçalera de grup de la llista expandida: «Avui», «Ahir», «dimecres», «12 de setembre».
    function dayLabel(time, now = Date.now()) {
        const days = dayDiff(now, time);
        if (days <= 0) return 'Avui';
        if (days === 1) return 'Ahir';
        if (days < 7) return WEEKDAYS[new Date(time).getDay()];
        return dateLabel(time, now);
    }

    function clockLabel(time) {
        const date = new Date(time);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // ---------- Historial ----------

    const timeOf = item => {
        const time = Date.parse(item?.viewedAt || '');
        return Number.isFinite(time) ? time : 0;
    };

    // Cançons escoltades (sense Shorts), de la més recent a la més antiga. El que no té data va al final.
    function songsOf(history) {
        const seen = new Set();
        return (Array.isArray(history) ? history : [])
            .filter(item => {
                const id = String(item?.id ?? '');
                if (!id || item.isShort || seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .map((item, index) => ({ item, index, time: timeOf(item) }))
            .sort((a, b) => b.time - a.time || a.index - b.index)
            .map(entry => ({ ...entry.item, _viewedTime: entry.time }));
    }

    // options: { now, expanded, range }
    // Retorna { total, latest, hasMore, expanded, ranges, range, rows, hidden }
    function buildHistoryModel(history, options = {}) {
        const now = Number.isFinite(options.now) ? options.now : Date.now();
        const songs = songsOf(history);
        const latest = songs.slice(0, LATEST).map(song => ({ ...song, when: formatWhen(song._viewedTime, now) }));
        const counts = RANGES.map(range => ({
            ...range,
            count: songs.filter(
                song => range.days === Infinity || (song._viewedTime && now - song._viewedTime <= range.days * DAY)
            ).length,
        }));
        // Només es mostren els períodes que afegeixen cançons respecte de l'anterior (anar expandint de debò).
        const ranges = counts.filter((range, index) => index === 0 || range.count > counts[index - 1].count);
        const wanted = ranges.find(range => range.id === options.range);
        const first = ranges.find(range => range.count > 0) || ranges[ranges.length - 1];
        const active = wanted || first;
        const inRange = songs.filter(
            song => active.days === Infinity || (song._viewedTime && now - song._viewedTime <= active.days * DAY)
        );
        const shown = inRange.slice(0, MAX_LIST);
        return {
            now,
            total: songs.length,
            latest,
            hasMore: songs.length > LATEST,
            expanded: Boolean(options.expanded) && songs.length > LATEST,
            ranges: ranges.map(range => ({ id: range.id, label: range.label, count: range.count })),
            range: active.id,
            rows: shown,
            hidden: Math.max(0, inRange.length - shown.length),
        };
    }

    const thumbnailOf = video =>
        video.thumbnail || `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/mqdefault.jpg`;

    function cardHtml(song) {
        return `
            <button type="button" class="mm-card" data-mm-play="${escapeHtml(song.id)}">
                <span class="mm-card__thumb"><img src="${escapeHtml(thumbnailOf(song))}" alt="" loading="lazy" decoding="async"></span>
                <span class="mm-card__body">
                    <span class="mm-card__title">${escapeHtml(song.title || 'Cançó')}</span>
                    <span class="mm-card__meta">${escapeHtml(song.channelTitle || '')}</span>
                    ${song.when ? `<span class="mm-card__when">${escapeHtml(song.when)}</span>` : ''}
                </span>
            </button>`;
    }

    function rowsHtml(model) {
        let group = '';
        const parts = [];
        model.rows.forEach(song => {
            const label = song._viewedTime ? dayLabel(song._viewedTime, model.now) : 'Sense data';
            if (label !== group) {
                group = label;
                parts.push(`<h3 class="mm-day">${escapeHtml(label)}</h3>`);
            }
            parts.push(`
                <button type="button" class="mm-row" data-mm-play="${escapeHtml(song.id)}">
                    <img class="mm-row__thumb" src="${escapeHtml(thumbnailOf(song))}" alt="" loading="lazy" decoding="async">
                    <span class="mm-row__text">
                        <span class="mm-row__title">${escapeHtml(song.title || 'Cançó')}</span>
                        <span class="mm-row__meta">${escapeHtml(song.channelTitle || '')}</span>
                    </span>
                    ${song._viewedTime ? `<time class="mm-row__time" datetime="${new Date(song._viewedTime).toISOString()}">${clockLabel(song._viewedTime)}</time>` : ''}
                </button>`);
        });
        return parts.join('');
    }

    function panelHtml(model) {
        if (!model.expanded) {
            return '<div class="mm-panel" id="mmHistoryPanel" role="region" aria-label="Historial per dates"></div>';
        }
        const chips = model.ranges
            .map(
                range => `
                <button type="button" class="mm-range${range.id === model.range ? ' is-active' : ''}" data-mm-range="${range.id}" aria-pressed="${range.id === model.range}">
                    ${escapeHtml(range.label)}<span class="mm-range__n">${range.count}</span>
                </button>`
            )
            .join('');
        const more = model.hidden
            ? `<p class="mm-more-note">Hi ha ${model.hidden} ${model.hidden === 1 ? 'cançó més' : 'cançons més'} en aquest període.</p>`
            : '';
        return `
            <div class="mm-panel is-open" id="mmHistoryPanel" role="region" aria-label="Historial per dates">
                <div class="mm-ranges" role="group" aria-label="Període de l'historial">${chips}</div>
                <div class="mm-list">${rowsHtml(model)}</div>
                ${more}
                <button type="button" class="mm-link mm-link--block" data-mm-open-history>Obre tot l’historial</button>
            </div>`;
    }

    function historyHtml(model) {
        if (!model.total) {
            return `
            <section class="mm-section" data-mm-section="history" aria-labelledby="mmHistoryTitle">
                <header class="mm-head"><h2 class="mm-title" id="mmHistoryTitle">Historial</h2></header>
                <p class="mm-empty">Encara no has escoltat cap cançó. Quan ho facis, aquí hi veuràs les últimes i podràs recórrer tot l’historial.</p>
            </section>`;
        }
        const label = model.expanded ? 'Amaga l’historial' : 'Mostra més de l’historial';
        const expand = model.hasMore
            ? `<button type="button" class="mm-expand${model.expanded ? ' is-open' : ''}" data-mm-expand aria-expanded="${model.expanded}" aria-controls="mmHistoryPanel" aria-label="${label}" title="${label}">${CHEVRON}</button>`
            : '';
        return `
            <section class="mm-section" data-mm-section="history" aria-labelledby="mmHistoryTitle">
                <header class="mm-head"><h2 class="mm-title" id="mmHistoryTitle">Historial</h2></header>
                <div class="mm-history-row">${model.latest.map(cardHtml).join('')}${expand}</div>
                ${panelHtml(model)}
            </section>`;
    }

    // ---------- Artistes (només els que se segueixen) ----------

    function buildArtistsModel(channels, followedIds) {
        const followed = new Set((Array.isArray(followedIds) ? followedIds : []).map(id => String(id)));
        const artists = (Array.isArray(channels) ? channels : [])
            .filter(channel => {
                const ids = Array.isArray(channel?.channelIds) && channel.channelIds.length
                    ? channel.channelIds.map(String)
                    : [String(channel?.id ?? '')];
                return ids.some(id => followed.has(id));
            })
            .map(channel => ({
                id: String(channel.id),
                name: String(channel.name || channel.title || '').trim() || 'Artista',
                avatar: channel.avatar || channel.thumbnail || '',
            }))
            .filter((artist, index, list) => artist.id && list.findIndex(item => item.id === artist.id) === index)
            .sort((a, b) => a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' }));
        return { artists, followed: artists.length };
    }

    function artistsHtml(model) {
        if (!model.artists.length) {
            return `
            <section class="mm-section" data-mm-section="artists" aria-labelledby="mmArtistsTitle">
                <header class="mm-head"><h2 class="mm-title" id="mmArtistsTitle">Artistes</h2></header>
                <p class="mm-empty">Encara no segueixes cap artista.</p>
                <button type="button" class="mm-link" data-mm-all-artists>Descobreix artistes</button>
            </section>`;
        }
        return `
            <section class="mm-section" data-mm-section="artists" aria-labelledby="mmArtistsTitle">
                <header class="mm-head">
                    <h2 class="mm-title" id="mmArtistsTitle">Artistes</h2>
                    <button type="button" class="mm-link" data-mm-all-artists>Descobreix-ne més</button>
                </header>
                <div class="mm-artists" role="list">
                    ${model.artists
                        .map(
                            artist => `
                    <button type="button" class="mm-artist" role="listitem" data-mm-artist="${escapeHtml(artist.id)}">
                        <span class="mm-artist__avatar"><img src="${escapeHtml(artist.avatar || FALLBACK_AVATAR)}" alt="" loading="lazy" decoding="async"></span>
                        <span class="mm-artist__name">${escapeHtml(artist.name)}</span>
                    </button>`
                        )
                        .join('')}
                </div>
            </section>`;
    }

    // ---------- DOM ----------

    function setExpanded(value) {
        state.expanded = Boolean(value);
    }

    function gather() {
        return {
            history: typeof getHistoryItems === 'function' ? getHistoryItems() : [],
            channels:
                typeof YouTubeAPI !== 'undefined' && typeof YouTubeAPI?.getArtistGroups === 'function'
                    ? YouTubeAPI.getArtistGroups()
                    : (Array.isArray(YouTubeAPI?.feedChannels) ? YouTubeAPI.feedChannels : []),
            followed: typeof getFollowedChannelIds === 'function' ? getFollowedChannelIds() : [],
        };
    }

    let container = null;

    function render(target) {
        container = target || container || window.document.getElementById('myMusic');
        if (!container) return false;
        const data = gather();
        const history = buildHistoryModel(data.history, { expanded: state.expanded, range: state.range });
        state.range = history.range;
        container.innerHTML = `${historyHtml(history)}${artistsHtml(buildArtistsModel(data.channels, data.followed))}`;
        bind(container);
        return true;
    }

    const call = (name, ...args) => (typeof window[name] === 'function' ? window[name](...args) : undefined);

    function bind(target) {
        if (target._mmBound) return;
        target._mmBound = true;
        target.addEventListener('click', event => {
            const play = event.target.closest('[data-mm-play]');
            if (play) {
                call('openVideoFromUserGesture', play.dataset.mmPlay, 'api');
                return;
            }
            if (event.target.closest('[data-mm-expand]')) {
                setExpanded(!state.expanded);
                render();
                window.document.querySelector('[data-mm-expand]')?.focus?.({ preventScroll: true });
                return;
            }
            const range = event.target.closest('[data-mm-range]');
            if (range) {
                state.range = range.dataset.mmRange;
                render();
                window.document.querySelector(`[data-mm-range="${state.range}"]`)?.focus?.({ preventScroll: true });
                return;
            }
            if (event.target.closest('[data-mm-open-history]')) {
                window.document.querySelector('.nav-trigger[data-page="historial"]')?.click();
                return;
            }
            const artist = event.target.closest('[data-mm-artist]');
            if (artist) {
                call('openChannelProfile', artist.dataset.mmArtist);
                return;
            }
            if (event.target.closest('[data-mm-all-artists]')) {
                call('showFollow', 'all');
            }
        });
    }

    app.features.myMusic = {
        LATEST,
        MAX_LIST,
        RANGES,
        state,
        formatWhen,
        dayLabel,
        songsOf,
        buildHistoryModel,
        historyHtml,
        buildArtistsModel,
        artistsHtml,
        render,
    };
})(window);
