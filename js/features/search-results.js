// Cerca de Segueix Música: model pur (primer els possibles artistes, després les cançons) i HTML del menú i
// de la pàgina de resultats. Implementació directa, sense DOM ni dependències: app.js hi passa el feed i
// pinta el que retorna (veure `buildSearchModel` i `navigateToSearchResults`).
//
// Regles de coincidència (docs/PROBLEMES_I_SOLUCIONS.md, «Cerca de Segueix Música»):
// - Sense accents, majúscules, apòstrofs ni punts volats: «al·lèrgiques» = «allergiques», «Mou-te» = «mou te».
// - Una cançó coincideix pel títol, pel nom de l'artista (i els seus àlies) i pels crèdits de la descripció
//   («Provided to YouTube»: cançó · artista · col·laboradors). MAI per la resta de la descripció ni per les
//   etiquetes: «pop» o «música» coincidirien amb gairebé tot el feed.
// - Un estil (categoria o gènere: «rock», «blues», «hip hop», «cançó d'autor»…) coincideix pel nom de la categoria i
//   pels gèneres que agrupa; surt entre els artistes i les cançons.
// - Un artista coincideix pel nom del canal, els noms de la base d'artistes i l'identificador (@handle).
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const MIN_QUERY_LENGTH = 2;
    const MAX_ARTISTS = 12;
    const MAX_GENRES = 4;
    // Cançons de la pàgina de resultats; és també el màxim de la ràdio que es pot generar amb la cerca.
    const MAX_SONGS = 60;
    const DROPDOWN_ARTISTS = 4;
    const DROPDOWN_GENRES = 3;
    const DROPDOWN_SONGS = 6;
    const MIN_SCORE = 0.3;
    const FALLBACK_AVATAR = 'img/icon-192.png';

    const RADIO_ICON =
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/></svg>';

    // ---------- Text ----------

    // Minúscules, sense marques (accents, ç), sense punts volats i només lletres i xifres separades per espais.
    function normalize(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/\p{M}+/gu, '')
            .toLowerCase()
            .replace(/[··]/g, '')
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    }

    function parseQuery(raw) {
        const text = String(raw ?? '').trim();
        const norm = normalize(text);
        const tokens = norm ? norm.split(' ') : [];
        return { raw: text, norm, tokens, valid: norm.length >= MIN_QUERY_LENGTH };
    }

    // Totes les paraules de la cerca hi són, en qualsevol ordre: les paraules senceres i l'última pot ser el
    // principi d'una paraula (mentre l'usuari escriu). «mou te» no coincideix amb «Moustaki … temps».
    function hasAllWords(text, tokens) {
        const padded = ` ${text} `;
        return tokens.every((token, index) =>
            padded.includes(index === tokens.length - 1 ? ` ${token}` : ` ${token} `)
        );
    }

    // Puntuació 0..1 d'un camp ja normalitzat contra la cerca.
    //   1 igual · .9 comença per la frase sencera · .85 comença per la cerca · .75 la frase surt sencera dins el
    //   camp · .65 la frase comença en una paraula · .55 totes les paraules (en qualsevol ordre) · .3 dins d'una
    //   paraula (només amb 4 lletres o més, si no seria soroll).
    function scoreField(field, query) {
        if (!field || !query?.norm) return 0;
        if (field === query.norm) return 1;
        if (field.startsWith(`${query.norm} `)) return 0.9;
        if (field.startsWith(query.norm)) return 0.85;
        if (` ${field} `.includes(` ${query.norm} `)) return 0.75;
        if (` ${field}`.includes(` ${query.norm}`)) return 0.65;
        if (query.tokens.length > 1 && hasAllWords(field, query.tokens)) return 0.55;
        if (query.norm.length >= 4 && field.includes(query.norm)) return 0.3;
        return 0;
    }

    function unique(values) {
        const seen = new Set();
        const list = [];
        values.forEach(value => {
            const text = String(value ?? '').trim();
            const key = normalize(text);
            if (!key || seen.has(key)) return;
            seen.add(key);
            list.push(text);
        });
        return list;
    }

    // Crèdits d'un tema de YouTube Music: «Provided to YouTube by X ⏎ Cançó · Artista · Col·laborador ⏎ …».
    function creditsOf(video) {
        const description = String(video?.description || '');
        if (!/^provided to youtube/i.test(description)) return '';
        const line = description
            .split('\n')
            .map(item => item.trim())
            .filter(Boolean)[1];
        if (!line || !line.includes(' · ')) return '';
        return line.split(' · ').slice(1).join(' ');
    }

    // ---------- Artistes ----------

    function namesOfChannel(channel) {
        const handle = String(channel?.handle || '').replace(/^@/, '');
        return {
            names: unique([channel?.name, channel?.title, ...(Array.isArray(channel?.artists) ? channel.artists : [])]),
            handle,
        };
    }

    function artistScore(channel, query) {
        const { names, handle } = namesOfChannel(channel);
        let best = 0;
        names.forEach(name => {
            best = Math.max(best, scoreField(normalize(name), query));
        });
        // L'identificador (@nom) compta una mica menys que el nom visible.
        if (handle) best = Math.max(best, 0.9 * scoreField(normalize(handle), query));
        return best;
    }

    function buildArtists(query, channels, options) {
        const artistKeyOf = typeof options.artistKeyOf === 'function' ? options.artistKeyOf : () => '';
        const primaryCategoryOf =
            typeof options.primaryCategoryOf === 'function' ? options.primaryCategoryOf : () => '';
        const songCounts = options.songCountByChannel || new Map();
        const groups = new Map();
        (Array.isArray(channels) ? channels : []).forEach(channel => {
            const id = String(channel?.id || '');
            if (!id) return;
            const score = artistScore(channel, query);
            if (score < MIN_SCORE) return;
            const name = String(channel.name || channel.title || '').trim();
            // Canals oficials i «Topic» d'un mateix artista comparteixen clau: surten com un sol artista.
            const key = artistKeyOf(id) || `n:${normalize(name)}`;
            const songs = songCounts.get(id) || 0;
            const group = groups.get(key);
            if (!group) {
                groups.set(key, { key, channel, score, songs, channelIds: [id] });
                return;
            }
            group.channelIds.push(id);
            group.score = Math.max(group.score, score);
            // El canal principal és el que té més cançons al feed
            if (songs > (songCounts.get(String(group.channel.id)) || 0)) group.channel = channel;
            group.songs += songs;
        });
        return Array.from(groups.values())
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    b.songs - a.songs ||
                    String(a.channel.name || '').localeCompare(String(b.channel.name || ''), 'ca', {
                        sensitivity: 'base',
                    })
            )
            .slice(0, MAX_ARTISTS)
            .map(group => {
                const channel = group.channel;
                const id = String(channel.id);
                const categories = Array.isArray(channel.categories) ? channel.categories : [];
                return {
                    id,
                    key: group.key,
                    name: String(channel.name || channel.title || '').trim(),
                    avatar: channel.avatar || channel.thumbnail || '',
                    subscriberCount: channel.subscriberCount ?? null,
                    style: primaryCategoryOf(id) || categories[0] || '',
                    channelIds: group.channelIds,
                    songs: group.songs,
                    score: group.score,
                };
            });
    }

    // ---------- Estils (categories i gèneres) ----------

    // Paraules d'una categoria: l'etiqueta sencera, cada tros separat per «/» i els gèneres que agrupa
    // («Punk / Metal» → punk, metal; «Clàssica» → clàssica i contemporània, coral / vocal).
    function genreTerms(group) {
        const labels = [group?.label, ...(Array.isArray(group?.genres) ? group.genres : [])];
        const terms = [];
        labels.forEach(label => {
            const text = String(label || '');
            terms.push(normalize(text));
            text.split('/').forEach(part => terms.push(normalize(part)));
        });
        return unique(terms);
    }

    function buildGenres(query, options) {
        const groups = Array.isArray(options.genres) ? options.genres : [];
        const songCounts = options.songCountByGenre || new Map();
        return groups
            .map(group => {
                let score = 0;
                genreTerms(group).forEach(term => {
                    score = Math.max(score, scoreField(term, query));
                });
                return { label: String(group.label || ''), score, songs: songCounts.get(group.label) || 0 };
            })
            .filter(genre => genre.label && genre.score >= MIN_SCORE)
            .sort((a, b) => b.score - a.score || b.songs - a.songs || a.label.localeCompare(b.label, 'ca'))
            .slice(0, MAX_GENRES);
    }

    // ---------- Cançons ----------

    const fieldCache = typeof WeakMap === 'function' ? new WeakMap() : null;

    // Camps normalitzats d'un vídeo (es calculen una vegada per objecte del feed).
    function fieldsOf(video) {
        let fields = fieldCache?.get(video);
        if (!fields) {
            fields = {
                title: normalize(video.title),
                artist: normalize(video.channelTitle),
                credits: normalize(creditsOf(video)),
            };
            fields.combined = `${fields.title} ${fields.artist}`.trim();
            fieldCache?.set(video, fields);
        }
        return fields;
    }

    function scoreSong(video, query, aliasNames) {
        const fields = fieldsOf(video);
        let best = scoreField(fields.title, query);
        best = Math.max(best, 0.85 * scoreField(fields.artist, query));
        aliasNames.forEach(name => {
            best = Math.max(best, 0.85 * scoreField(name, query));
        });
        // Una cerca de diverses paraules pot repartir-se entre el títol i l'artista («judit mou te»)
        if (query.tokens.length > 1 && hasAllWords(`${fields.combined} ${aliasNames.join(' ')}`, query.tokens)) {
            best = Math.max(best, 0.5);
        }
        best = Math.max(best, 0.6 * scoreField(fields.credits, query));
        return best;
    }

    function popularityOf(video) {
        return Number(video?.viewCount ?? video?.views ?? 0) || 0;
    }

    function timeOf(video) {
        const time = new Date(video?.publishedAt || video?.uploadDate || 0).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    // Duplicats fiables (mateixa gravació: mateix artista, títol base i durada gairebé igual) amb el motor de
    // selecció si hi és; sense ell, mateix canal i mateix títol.
    function makeDeduper(options) {
        const keysOf = typeof options.recordingKeysOf === 'function' ? options.recordingKeysOf : null;
        const same = typeof options.sameRecording === 'function' ? options.sameRecording : null;
        const buckets = new Map();
        return video => {
            let keys = null;
            if (keysOf) {
                try {
                    keys = keysOf(video);
                } catch (error) {
                    keys = null;
                }
            }
            const bucketKey = keys?.recording || `${normalize(video.channelTitle)}|${normalize(video.title)}`;
            const bucket = buckets.get(bucketKey) || [];
            const duplicate = bucket.some(other => (keys && same ? same(other, keys) : true));
            if (!duplicate) {
                bucket.push(keys);
                buckets.set(bucketKey, bucket);
            }
            return duplicate;
        };
    }

    function buildSongs(query, videos, options) {
        const isEligible = typeof options.isEligible === 'function' ? options.isEligible : () => true;
        const aliasesByChannel = options.aliasesByChannel || new Map();
        const scored = [];
        (Array.isArray(videos) ? videos : []).forEach(video => {
            if (!video?.id || video.isShort || video.source === 'static' || !isEligible(video)) return;
            const aliases = aliasesByChannel.get(String(video.channelId || video.sourceChannelId || '')) || [];
            const score = scoreSong(video, query, aliases);
            if (score >= MIN_SCORE) scored.push({ video, score });
        });
        scored.sort(
            (a, b) =>
                b.score - a.score ||
                popularityOf(b.video) - popularityOf(a.video) ||
                timeOf(b.video) - timeOf(a.video) ||
                String(a.video.title || '').localeCompare(String(b.video.title || ''), 'ca', { sensitivity: 'base' })
        );
        const limit = Number.isFinite(options.limit) ? options.limit : Infinity;
        const isDuplicate = makeDeduper(options);
        const songs = [];
        for (const item of scored) {
            if (songs.length >= limit) break;
            if (isDuplicate(item.video)) continue;
            songs.push({ ...item.video, score: item.score });
        }
        return songs;
    }

    // ---------- Model ----------

    // options: { channels, videos, genres: [{ label, genres }], categoriesOfChannel(id), artistKeyOf(id),
    //            primaryCategoryOf(id), isEligible(video), recordingKeysOf(video), sameRecording(a, b), limit }
    // Retorna { query, artists, genres, songs, hasResults, radio: { available, count, artists } }.
    function buildModel(rawQuery, options = {}) {
        const query = parseQuery(rawQuery);
        const empty = {
            query: query.raw,
            artists: [],
            genres: [],
            songs: [],
            hasResults: false,
            radio: unavailableRadio(),
        };
        if (!query.valid) return empty;

        const channels = Array.isArray(options.channels) ? options.channels : [];
        const videos = Array.isArray(options.videos) ? options.videos : [];
        const songCountByChannel = new Map();
        videos.forEach(video => {
            const id = String(video?.channelId || video?.sourceChannelId || '');
            if (id && !video.isShort) songCountByChannel.set(id, (songCountByChannel.get(id) || 0) + 1);
        });
        // Noms alternatius de l'artista (base d'artistes) perquè «alfred garcia» trobi el canal «alfredgarcia».
        const aliasesByChannel = new Map();
        channels.forEach(channel => {
            const { names } = namesOfChannel(channel);
            aliasesByChannel.set(String(channel?.id || ''), names.map(normalize).filter(Boolean));
        });

        const artists = buildArtists(query, channels, { ...options, songCountByChannel });
        // Cançons per estil (només dels estils que coincideixen): el que veuràs en obrir-lo.
        const categoriesOfChannel =
            typeof options.categoriesOfChannel === 'function' ? options.categoriesOfChannel : () => [];
        const songCountByGenre = new Map();
        songCountByChannel.forEach((count, channelId) => {
            (categoriesOfChannel(channelId) || []).forEach(label => {
                songCountByGenre.set(label, (songCountByGenre.get(label) || 0) + count);
            });
        });
        const genres = buildGenres(query, { ...options, songCountByGenre });
        const songs = buildSongs(query, videos, {
            ...options,
            aliasesByChannel,
            limit: Number.isFinite(options.limit) ? options.limit : MAX_SONGS,
        });
        const artistNames = new Set(songs.map(song => normalize(song.channelTitle)).filter(Boolean));
        return {
            query: query.raw,
            artists,
            genres,
            songs,
            hasResults: artists.length > 0 || genres.length > 0 || songs.length > 0,
            radio: {
                available: songs.length >= 2,
                count: songs.length,
                artists: artistNames.size,
            },
        };
    }

    function unavailableRadio() {
        return { available: false, count: 0, artists: 0 };
    }

    // ---------- HTML ----------

    function escapeHtml(value) {
        return String(value ?? '').replace(
            /[&<>"']/g,
            char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
        );
    }

    function plural(count, one, many) {
        return `${count} ${count === 1 ? one : many}`;
    }

    function radioSummary(model) {
        const { count, artists } = model.radio;
        return `${plural(count, 'cançó', 'cançons')} · ${plural(artists, 'artista', 'artistes')} · estils barrejats`;
    }

    function yearOf(video) {
        const original = Number(video?.originalYear);
        if (Number.isFinite(original) && original > 1900) return String(original);
        return String(video?.publishedAt || video?.uploadDate || '').slice(0, 4);
    }

    function thumbnailOf(video) {
        return video.thumbnail || `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/mqdefault.jpg`;
    }

    // Botó «Genera una ràdio amb aquests resultats» (a dalt de tot del menú i de la pàgina).
    function radioButtonHtml(model, variant = 'page') {
        if (!model?.radio?.available) return '';
        const query = escapeHtml(model.query);
        if (variant === 'dropdown') {
            return `
            <div class="search-section search-section--radio" role="group" aria-label="Ràdio">
                <button type="button" class="search-result-item search-radio-item" data-result-type="radio" data-search-query="${query}">
                    <span class="search-radio-icon" aria-hidden="true">${RADIO_ICON}</span>
                    <div class="search-result-info">
                        <span class="name">Genera una ràdio amb aquests resultats</span>
                        <span class="meta">${escapeHtml(radioSummary(model))}</span>
                    </div>
                </button>
            </div>`;
        }
        return `
            <div class="search-radio-bar">
                <button type="button" class="search-radio-btn" data-search-radio data-search-query="${query}">
                    <span class="search-radio-icon" aria-hidden="true">${RADIO_ICON}</span>
                    <span class="search-radio-text">
                        <span class="search-radio-title">Genera una ràdio amb aquests resultats</span>
                        <span class="search-radio-meta">${escapeHtml(radioSummary(model))}</span>
                    </span>
                </button>
            </div>`;
    }

    const GENRE_ICON =
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="7" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="15" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 17V5l10-2v12"/></svg>';

    function genreMeta(genre) {
        return genre.songs ? `Estil · ${plural(genre.songs, 'cançó', 'cançons')}` : 'Estil';
    }

    function artistMeta(artist) {
        return artist.style ? `${artist.style} · Artista` : 'Artista';
    }

    // Menú desplegable: ràdio, artistes, vídeos i, si en falten, «Veure tots els resultats».
    function dropdownHtml(model) {
        if (!model?.hasResults) {
            return `<div class="search-no-results" role="status">No hem trobat cap artista, estil ni cançó.</div>`;
        }
        const artists = model.artists.slice(0, DROPDOWN_ARTISTS);
        const songs = model.songs.slice(0, DROPDOWN_SONGS);
        const artistMarkup = artists.length
            ? `
            <div class="search-section" role="group" aria-label="Artistes">
                <h4>Artistes</h4>
                ${artists
                    .map(
                        artist => `
                <button type="button" class="search-result-item" data-result-type="artist" data-channel-id="${escapeHtml(artist.id)}">
                    <img class="search-result-avatar" src="${escapeHtml(artist.avatar || FALLBACK_AVATAR)}" alt="" loading="lazy" decoding="async">
                    <div class="search-result-info">
                        <span class="name">${escapeHtml(artist.name || 'Artista')}</span>
                        <span class="meta">${escapeHtml(artistMeta(artist))}</span>
                    </div>
                </button>`
                    )
                    .join('')}
            </div>`
            : '';
        const genres = (model.genres || []).slice(0, DROPDOWN_GENRES);
        const genreMarkup = genres.length
            ? `
            <div class="search-section" role="group" aria-label="Estils">
                <h4>Estils</h4>
                ${genres
                    .map(
                        genre => `
                <button type="button" class="search-result-item search-genre-item" data-result-type="genre" data-genre="${escapeHtml(genre.label)}">
                    <span class="search-genre-icon" aria-hidden="true">${GENRE_ICON}</span>
                    <div class="search-result-info">
                        <span class="name">${escapeHtml(genre.label)}</span>
                        <span class="meta">${escapeHtml(genreMeta(genre))}</span>
                    </div>
                </button>`
                    )
                    .join('')}
            </div>`
            : '';
        const songMarkup = songs.length
            ? `
            <div class="search-section" role="group" aria-label="Vídeos">
                <h4>Vídeos</h4>
                ${songs
                    .map(video => {
                        const year = yearOf(video);
                        const meta = [video.channelTitle, year].filter(Boolean).map(escapeHtml).join(' · ');
                        return `
                <button type="button" class="search-result-item" data-result-type="video" data-video-id="${escapeHtml(video.id)}" data-video-source="api">
                    <img class="search-result-thumb" src="${escapeHtml(thumbnailOf(video))}" alt="" loading="lazy" decoding="async">
                    <div class="search-result-info">
                        <span class="title">${escapeHtml(video.title)}</span>
                        <span class="meta">${meta}</span>
                    </div>
                </button>`;
                    })
                    .join('')}
            </div>`
            : '';
        const hasMore =
            model.artists.length > artists.length ||
            (model.genres || []).length > genres.length ||
            model.songs.length > songs.length;
        const moreMarkup = hasMore
            ? `
            <div class="search-section search-section--more" role="group" aria-label="Més resultats">
                <button type="button" class="search-result-item search-more-item" data-result-type="all" data-search-query="${escapeHtml(model.query)}">
                    <div class="search-result-info">
                        <span class="name">Veure tots els resultats</span>
                    </div>
                </button>
            </div>`
            : '';
        return `${radioButtonHtml(model, 'dropdown')}${artistMarkup}${genreMarkup}${songMarkup}${moreMarkup}`;
    }

    function emptyHtml(model) {
        return `
            <div class="search-error" role="status">
                <i data-lucide="search-x"></i>
                <p>No hem trobat cap artista, estil ni cançó per «${escapeHtml(model?.query || '')}».</p>
                <p class="search-error__hint">Prova amb el nom d'un artista, un estil o el títol d'una cançó.</p>
            </div>`;
    }

    // Pàgina de resultats: ràdio a dalt de tot, després els artistes i després els vídeos.
    // `cardHtml(video)` pinta la targeta d'una cançó (la posa app.js, que en té les accions).
    // Foto del grup prou gran per omplir el requadre (com «Artistes i grups»)
    function artistPhoto(url) {
        const src = String(url || '').replace(/^http:\/\//i, 'https://');
        return /\/\/yt3\.(ggpht|googleusercontent)\.com\//i.test(src) ? src.replace(/=s\d+(?=-|$)/, '=s400') : src;
    }

    function pageHtml(model, helpers = {}) {
        if (!model?.hasResults) return `<div class="search-results" data-search-results>${emptyHtml(model)}</div>`;
        const cardHtml = typeof helpers.cardHtml === 'function' ? helpers.cardHtml : () => '';
        const artistSection = model.artists.length
            ? `
            <section class="search-results-section" aria-label="Artistes">
                <h2 class="search-results-title">Artistes</h2>
                <div class="follow-grid search-channel-grid">
                    ${model.artists
                        .map(
                            artist => `
                    <div class="follow-card search-channel-card" data-channel-id="${escapeHtml(artist.id)}" role="link" tabindex="0" aria-label="Fitxa de ${escapeHtml(artist.name || 'Artista')}">
                        <img class="follow-avatar" src="${escapeHtml(artistPhoto(artist.avatar) || FALLBACK_AVATAR)}" alt="" loading="lazy" decoding="async">
                        <span class="follow-card__shade" aria-hidden="true"></span>
                        <div class="follow-card__info">
                            <div class="follow-name">${escapeHtml(artist.name || 'Artista')}</div>
                            ${artist.style ? `<div class="search-artist-style">${escapeHtml(artist.style)}</div>` : ''}
                            <button class="follow-toggle-btn" type="button" data-follow-channel="${escapeHtml(artist.id)}" aria-pressed="false">Segueix</button>
                        </div>
                    </div>`
                        )
                        .join('')}
                </div>
            </section>`
            : '';
        const genreSection = (model.genres || []).length
            ? `
            <section class="search-results-section" aria-label="Estils">
                <h2 class="search-results-title">Estils</h2>
                <div class="search-genre-list">
                    ${model.genres
                        .map(
                            genre => `
                    <div class="search-genre-card" data-genre="${escapeHtml(genre.label)}">
                        <button type="button" class="search-genre-open" data-search-genre="${escapeHtml(genre.label)}">
                            <span class="search-genre-icon" aria-hidden="true">${GENRE_ICON}</span>
                            <span class="search-genre-text">
                                <span class="search-genre-name">${escapeHtml(genre.label)}</span>
                                <span class="search-genre-meta">${escapeHtml(genreMeta(genre))}</span>
                            </span>
                        </button>
                        <button type="button" class="search-genre-radio" data-search-style-radio="${escapeHtml(genre.label)}" aria-label="Ràdio de ${escapeHtml(genre.label)}" title="Ràdio de ${escapeHtml(genre.label)}">${RADIO_ICON}</button>
                    </div>`
                        )
                        .join('')}
                </div>
            </section>`
            : '';
        const songSection = model.songs.length
            ? `
            <section class="search-results-section" aria-label="Vídeos">
                <h2 class="search-results-title">Vídeos</h2>
                <div class="videos-grid">
                    ${model.songs.map(video => cardHtml(video)).join('')}
                </div>
            </section>`
            : '';
        return `<div class="search-results" data-search-results data-search-query="${escapeHtml(model.query)}">${radioButtonHtml(model, 'page')}${artistSection}${genreSection}${songSection}</div>`;
    }

    app.features.searchResults = {
        MIN_QUERY_LENGTH,
        MAX_ARTISTS,
        MAX_GENRES,
        MAX_SONGS,
        DROPDOWN_ARTISTS,
        DROPDOWN_GENRES,
        DROPDOWN_SONGS,
        normalize,
        parseQuery,
        scoreField,
        creditsOf,
        buildModel,
        radioButtonHtml,
        dropdownHtml,
        pageHtml,
        emptyHtml,
        escapeHtml,
    };
})(window);
