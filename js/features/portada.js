// Portada de Segueix Música («La teva plaça musical»).
// Implementació directa (patró 2). Es pinta dins #videosGrid quan la categoria és «Novetats» (Inici) i
// reutilitza el que ja hi ha: la cua de música-queue.js, el reproductor únic d'app.js, el modal de llistes,
// el perfil d'artista i els xips d'estil (que continuen sent la font de veritat de les categories).
//
// Estructura:
//  - buildModel(ctx): pur i testable. Decideix què surt a cada secció a partir de les dades reals.
//  - renderSections(model): pur. Retorna l'HTML de les seccions C–G (l'entrada B i la capçalera A són a index.html).
//  - La resta gestiona esdeveniments i l'estat viu («Ara sona», mode de descoberta).
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const DAY_MS = 86400000;
    const FRESH_ROW = 12;
    const FRESH_ALL = 48;
    const RADAR_ROW = 12;
    const LIVE_ROW = 10;
    const MIN_FRESH = 3;
    const MIN_RADAR = 3;
    const MIN_LIVE = 2;
    const MAX_PER_ARTIST = 2;

    const ICONS = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
        // Afegeix a la cua: llista que continua
        queue: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 6h11M4 12h7M4 18h7M15 13v7M11.5 16.5h7"/></svg>',
        // Desa en una llista: adreça d'interès amb un més
        save: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 4.5h12a.5.5 0 0 1 .5.5v15l-6.5-3.8L5.5 20V5a.5.5 0 0 1 .5-.5ZM12 8v5M9.5 10.5h5"/></svg>',
        left: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m15 6-6 6 6 6"/></svg>',
        right: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6"/></svg>',
        shuffle:
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
        plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
        minus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M5 12h14"/></svg>',
        list: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h10"/></svg>',
    };

    const state = {
        container: null,
        lastInput: null,
        lastSignature: '',
        registry: new Map(),
        expanded: { fresh: false, styles: false },
        rendered: false,
        bound: false,
        featured: null,
        model: null,
    };

    // ---------- Utilitats pures ----------

    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);
    const toArray = value => (Array.isArray(value) ? value : []);

    // Les fotos de perfil de YouTube porten la mida a la URL (=s800-c...): en demanem una de prou petita.
    function avatarUrl(url, size = 240) {
        const value = String(url || '');
        return /=s\d+(-|$)/.test(value) ? value.replace(/=s\d+(-|$)/, `=s${size}$1`) : value;
    }

    function timestampOf(video) {
        const time = new Date(video?.publishedAt || video?.uploadDate || 0).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    // La data de què disposem és la de publicació del vídeo: no es presenta mai com a data de llançament del disc.
    function publishedLabel(video, now = Date.now()) {
        const time = timestampOf(video);
        if (!time) return '';
        const days = Math.floor((now - time) / DAY_MS);
        if (days < 0) return '';
        if (days === 0) return 'Publicat avui';
        if (days === 1) return 'Publicat ahir';
        if (days < 14) return `Publicat fa ${days} dies`;
        if (days < 60) return `Publicat fa ${Math.round(days / 7)} setmanes`;
        if (days < 365) {
            const months = Math.max(2, Math.round(days / 30));
            return `Publicat fa ${months} mesos`;
        }
        const years = Math.floor(days / 365);
        return years === 1 ? 'Publicat fa 1 any' : `Publicat fa ${years} anys`;
    }

    function durationLabel(video) {
        try {
            return typeof getVideoDisplayDuration === 'function' ? getVideoDisplayDuration(video) || '' : '';
        } catch (error) {
            return '';
        }
    }

    const artistName = video => String(video?.channelTitle || video?.snippet?.channelTitle || 'Artista');
    const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    // ---------- Model (pur) ----------

    // ctx: { recent, all, channels, history, liked, followedIds, hiddenIds, playlists, now, rng, isClip, isClassic }
    function buildModel(ctx = {}) {
        const discovery = ctx.discovery || app.features.discovery;
        const now = ctx.now ?? Date.now();
        const rng = ctx.rng || Math.random;
        const hidden = ctx.hiddenIds instanceof Set ? ctx.hiddenIds : new Set();
        // Preferències explícites: «Menys com aquesta» i «No em recomanis aquest artista» també valen a la portada.
        const rejected = typeof ctx.isRejected === 'function' ? ctx.isRejected : () => false;
        const usable = video =>
            video?.id && !video.isShort && !hidden.has(String(video.channelId || '')) && !rejected(video);

        const all = toArray(ctx.all).filter(usable);
        const recent = toArray(ctx.recent)
            .filter(video => usable(video) && discovery.isStudioSong(video) && video.thumbnail)
            .sort((a, b) => timestampOf(b) - timestampOf(a));
        const channels = discovery.normalizeChannels(ctx.channels);
        const history = toArray(ctx.history);
        const profile = discovery.buildProfile({
            history,
            liked: ctx.liked,
            followedIds: ctx.followedIds,
            channels,
        });

        const model = {
            status: all.length || recent.length ? 'ready' : 'empty',
            hasHistory: history.some(video => video && !video.isShort),
            profile,
            featured: null,
            lead: null,
            fresh: null,
            radar: null,
            styles: [],
            live: null,
        };
        if (model.status === 'empty') return model;

        const placement = discovery.createPlacement({ maxPerArtist: MAX_PER_ARTIST });
        const taken = new Set();
        const take = video => {
            if (!placement.take(video)) return false;
            taken.add(String(video.id));
            return true;
        };

        // Una reedició o un arxiu pujat fa poc NO és una estrena: «Acabades de sortir» només porta novetats
        // reals (motor de selecció: any original, llista d'artistes antics i data de pujada).
        const isNew = typeof ctx.isNewRelease === 'function' ? ctx.isNewRelease : null;
        const newest = isNew ? recent.filter(video => isNew(video)) : recent;

        // B · novetat destacada de l'entrada
        const featured = discovery.pickFeatured({
            videos: newest.length ? newest : recent.length ? recent : all,
            profile,
            isClip: ctx.isClip,
            isNew,
            now,
        });
        if (featured) {
            take(featured.video);
            model.featured = featured;
        }

        // D · acabades de sortir: cronològic, un vídeo per artista a la fila
        const seenFresh = new Set();
        const freshRow = [];
        newest.forEach(video => {
            const key = discovery.artistKeyOf(video);
            if (freshRow.length >= FRESH_ROW || (key && seenFresh.has(key)) || taken.has(String(video.id))) return;
            if (!take(video)) return;
            if (key) seenFresh.add(key);
            freshRow.push(video);
        });
        if (freshRow.length >= MIN_FRESH) {
            model.fresh = {
                title: 'Acabades de sortir',
                subtitle: 'Vídeos publicats fa poc, dels més nous als més antics',
                videos: freshRow,
                all: freshRow,
            };
        } else {
            freshRow.forEach(video => taken.delete(String(video.id)));
        }

        // G · en directe (es tria abans que el radar perquè és el catàleg més reduït): només actuacions (live_song), un vídeo per artista
        const seenLive = new Set();
        const liveVideos = [];
        all.filter(discovery.isLiveSong)
            .filter(video => video.thumbnail)
            .sort((a, b) => timestampOf(b) - timestampOf(a))
            .forEach(video => {
                const key = discovery.artistKeyOf(video);
                if (liveVideos.length >= LIVE_ROW || (key && seenLive.has(key)) || taken.has(String(video.id))) return;
                if (!take(video)) return;
                if (key) seenLive.add(key);
                liveVideos.push(video);
            });
        if (liveVideos.length >= MIN_LIVE) {
            model.live = {
                title: 'En directe',
                subtitle: 'Actuacions gravades en directe',
                videos: liveVideos,
            };
        }

        // Explicacions honestes («Perquè segueixes…»): només amb senyals reals de l'usuari.
        model.reasons = new Map();
        const selection = ctx.selection || null;
        const explain = video => {
            if (!selection || !ctx.signals || !video?.id) return;
            const reason = selection.reasonFor(video, ctx.selectionCtx, ctx.signals);
            if (reason) model.reasons.set(String(video.id), reason);
        };
        // Preferides i repeticions reals amb varietat (cors, escoltes voluntàries, finalitzacions).
        const preferred =
            selection && ctx.signals
                ? selection.pickReturn({
                      ctx: ctx.selectionCtx,
                      candidates: all,
                      signals: ctx.signals,
                      limit: 4,
                      rng,
                      now,
                  })
                : [];

        // C · «Torna-hi» (amb historial o amb preferides reals) o «Comença per aquí»
        if (model.hasHistory || preferred.length) {
            const items = discovery.pickReturnItems({
                history,
                playlists: ctx.playlists,
                channels,
                limit: 6,
                preferred,
            });
            if (items.length) {
                model.lead = {
                    kind: 'return',
                    title: 'Torna-hi',
                    subtitle: preferred.length
                        ? 'Les teves preferides, el que has tornat a triar i llistes'
                        : 'Cançons, artistes i llistes que has escoltat fa poc',
                    items,
                };
            }
        } else {
            const picks = discovery.pickStartHere({
                videos: all.filter(video => !taken.has(String(video.id)) && placement.can(video)),
                profile,
                limit: 6,
                rng,
                isClassic: ctx.isClassic,
            });
            if (picks.length) {
                picks.forEach(take);
                model.lead = {
                    kind: 'start',
                    title: 'Comença per aquí',
                    subtitle: 'Una selecció variada del catàleg',
                    items: picks.map(video => ({
                        type: 'song',
                        id: String(video.id),
                        video,
                        title: video.title || '',
                        subtitle: artistName(video),
                        image: video.thumbnail || '',
                    })),
                };
            }
        }

        // E · fora del teu radar / per descobrir
        const capped = new Set();
        all.forEach(video => {
            const key = discovery.artistKeyOf(video);
            if (key && placement.count(key) >= MAX_PER_ARTIST) capped.add(key);
        });
        // Descoberta actual: els artistes per descobrir són de música recent o mitjana (no reedicions antigues).
        const isCurrent = typeof ctx.isCurrent === 'function' ? ctx.isCurrent : () => true;
        const radar = discovery.pickRadar({
            videos: all.filter(video => !taken.has(String(video.id)) && isCurrent(video)),
            profile,
            limit: RADAR_ROW,
            rng,
            exclude: capped,
        });
        const radarItems = radar.items.filter(item => take(item.video));
        if (radarItems.length >= MIN_RADAR) {
            model.radar = {
                title: radar.title,
                subtitle: radar.subtitle,
                personalized: radar.personalized,
                items: radarItems,
            };
        } else {
            radarItems.forEach(item => taken.delete(String(item.video.id)));
        }

        // F · estils reals
        model.styles = discovery.summarizeStyles({ videos: all, channels });

        freshRow.forEach(explain);
        model.radar?.items.forEach(item => explain(item.video));

        // «Veure-ho tot» de les novetats: totes les recents cronològicament, sense repetir cap cançó que ja
        // surt en una altra fila (es calcula al final perquè les altres files ja han triat les seves).
        if (model.fresh) {
            const rowIds = new Set(freshRow.map(video => String(video.id)));
            model.fresh.all = newest
                .filter(video => rowIds.has(String(video.id)) || !taken.has(String(video.id)))
                .slice(0, FRESH_ALL);
        }
        return model;
    }

    // ---------- HTML (pur) ----------

    function cardHtml(video, opts = {}) {
        const id = esc(video.id);
        const title = esc(video.title || 'Cançó');
        const artist = esc(artistName(video));
        const duration = durationLabel(video);
        const meta = opts.meta === undefined ? publishedLabel(video, opts.now) : opts.meta;
        return `
            <article class="pt-card${opts.wide ? ' pt-card--wide' : ''}" data-video-id="${id}">
                <button type="button" class="pt-card__media" data-pt-play="${id}" aria-label="Reprodueix ${title}, de ${artist}">
                    <img src="${esc(video.thumbnail)}" alt="" loading="lazy" decoding="async" width="320" height="180">
                    ${opts.badge ? `<span class="pt-card__badge">${esc(opts.badge)}</span>` : ''}
                    ${duration ? `<span class="pt-card__dur">${esc(duration)}</span>` : ''}
                    <span class="pt-card__play" aria-hidden="true">${ICONS.play}</span>
                </button>
                <div class="pt-card__body">
                    <div class="pt-card__text">
                        <h3 class="pt-card__title" data-pt-play="${id}">${title}</h3>
                        <button type="button" class="pt-artist" data-pt-artist="${esc(video.channelId)}" aria-label="Obre l’artista: ${artist}">${artist}</button>
                        ${opts.reason ? `<p class="pt-card__reason">${esc(opts.reason)}</p>` : ''}
                        ${meta ? `<p class="pt-card__meta">${esc(meta)}</p>` : ''}
                    </div>
                    <div class="pt-card__actions">
                        <button type="button" class="pt-act" data-pt-queue="${id}" aria-label="Afegeix a la cua: ${title}" title="Afegeix a la cua">${ICONS.queue}</button>
                        <button type="button" class="pt-act" data-pt-save="${id}" aria-label="Desa en una llista: ${title}" title="Desa en una llista">${ICONS.save}</button>
                    </div>
                </div>
            </article>`;
    }

    function portraitHtml(item) {
        const video = item.video;
        const id = esc(video.id);
        const name = esc(item.name || artistName(video));
        const song = esc(video.title || 'Cançó');
        const image = item.avatar
            ? `<img src="${esc(avatarUrl(item.avatar, 240))}" alt="" loading="lazy" decoding="async" width="120" height="120">`
            : `<span class="pt-portrait__ph" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</span>`;
        const note = item.reason
            ? `<p class="pt-portrait__reason">${esc(item.reason)}</p>`
            : item.styles?.length
              ? `<p class="pt-portrait__reason pt-portrait__reason--style">${esc(item.styles.slice(0, 2).join(' · '))}</p>`
              : '';
        return `
            <article class="pt-portrait" data-video-id="${id}">
                <div class="pt-portrait__img" data-pt-artist="${esc(item.channelId)}">${image}</div>
                <button type="button" class="pt-artist pt-portrait__name" data-pt-artist="${esc(item.channelId)}" aria-label="Obre l’artista: ${name}">${name}</button>
                ${note}
                <p class="pt-portrait__song" title="${song}">${song}</p>
                <div class="pt-portrait__actions">
                    <button type="button" class="pt-act pt-act--play" data-pt-play="${id}" aria-label="Reprodueix ${song}, de ${name}" title="Reprodueix">${ICONS.play}</button>
                    <button type="button" class="pt-act" data-pt-queue="${id}" aria-label="Afegeix a la cua: ${song}" title="Afegeix a la cua">${ICONS.queue}</button>
                    <button type="button" class="pt-act" data-pt-save="${id}" aria-label="Desa en una llista: ${song}" title="Desa en una llista">${ICONS.save}</button>
                </div>
            </article>`;
    }

    function quickHtml(item) {
        if (item.type === 'artist') {
            const name = esc(item.title);
            return `
                <button type="button" class="pt-quick__main" data-pt-artist="${esc(item.id)}" aria-label="Obre l’artista: ${name}">
                    <span class="pt-quick__thumb pt-quick__thumb--round">${
                        item.image
                            ? `<img src="${esc(avatarUrl(item.image, 120))}" alt="" loading="lazy" decoding="async" width="56" height="56">`
                            : ''
                    }</span>
                    <span class="pt-quick__text"><span class="pt-quick__kicker">Artista</span><span class="pt-quick__title">${name}</span></span>
                </button>`;
        }
        if (item.type === 'list') {
            const name = esc(item.title);
            const images = toArray(item.images);
            const cover =
                images.length >= 4
                    ? `<span class="pt-quick__mosaic">${images.map(src => `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`).join('')}</span>`
                    : images.length
                      ? `<img src="${esc(images[0])}" alt="" loading="lazy" decoding="async">`
                      : '';
            return `
                <button type="button" class="pt-quick__main" data-pt-list="${esc(item.id)}" aria-label="Reprodueix la llista ${name}">
                    <span class="pt-quick__thumb pt-quick__thumb--list">${cover}</span>
                    <span class="pt-quick__text"><span class="pt-quick__kicker">Llista · ${esc(item.subtitle)}</span><span class="pt-quick__title">${name}</span></span>
                </button>`;
        }
        const title = esc(item.title);
        const artist = esc(item.subtitle);
        return `
            <button type="button" class="pt-quick__main" data-pt-play="${esc(item.id)}" aria-label="Reprodueix ${title}, de ${artist}">
                <span class="pt-quick__thumb"><img src="${esc(item.image)}" alt="" loading="lazy" decoding="async" width="96" height="54"></span>
                <span class="pt-quick__text"><span class="pt-quick__kicker">${esc(item.reason || 'Cançó')}</span><span class="pt-quick__title">${title}</span><span class="pt-quick__sub">${artist}</span></span>
            </button>`;
    }

    function headHtml({ id, title, subtitle, tools = '' }) {
        return `
            <header class="pt-head">
                <div class="pt-head__text">
                    <h2 class="pt-head__title" id="${id}">${esc(title)}</h2>
                    ${subtitle ? `<p class="pt-head__sub">${esc(subtitle)}</p>` : ''}
                </div>
                <div class="pt-head__tools">${tools}</div>
            </header>`;
    }

    const arrowTools = `
        <button type="button" class="pt-arrow" data-pt-scroll="-1" aria-label="Anterior">${ICONS.left}</button>
        <button type="button" class="pt-arrow" data-pt-scroll="1" aria-label="Següent">${ICONS.right}</button>`;

    const playAllButton = (key, label) =>
        `<button type="button" class="pt-tool pt-tool--play" data-pt-play-all="${key}" aria-label="${esc(label)}">${ICONS.play}<span>Reprodueix-ho</span></button>`;

    function leadHtml(lead) {
        const tools =
            lead.kind === 'return' ? '<button type="button" class="pt-tool" data-pt-history>Historial</button>' : '';
        return `
            <section class="pt-section pt-section--lead" aria-labelledby="ptH-lead" data-pt-section="lead">
                ${headHtml({ id: 'ptH-lead', title: lead.title, subtitle: lead.subtitle, tools })}
                <ul class="pt-quick-list">
                    ${lead.items.map(item => `<li class="pt-quick pt-quick--${item.type}">${quickHtml(item)}</li>`).join('')}
                </ul>
            </section>`;
    }

    function freshHtml(fresh, expanded, now, reasons = null) {
        const videos = expanded ? fresh.all : fresh.videos;
        const canExpand = fresh.all.length > fresh.videos.length;
        const tools = `
            ${playAllButton('fresh', 'Reprodueix les novetats')}
            ${canExpand ? `<button type="button" class="pt-tool" data-pt-more="fresh" aria-expanded="${expanded}">${expanded ? 'Mostra’n menys' : 'Veure-ho tot'}</button>` : ''}
            ${expanded ? '' : arrowTools}`;
        return `
            <section class="pt-section pt-section--fresh${expanded ? ' is-expanded' : ''}" aria-labelledby="ptH-fresh" data-pt-section="fresh">
                ${headHtml({ id: 'ptH-fresh', title: fresh.title, subtitle: fresh.subtitle, tools })}
                <ul class="pt-row">
                    ${videos.map(video => `<li class="pt-cell">${cardHtml(video, { now, reason: reasons?.get?.(String(video.id)) })}</li>`).join('')}
                </ul>
            </section>`;
    }

    function radarHtml(radar) {
        return `
            <section class="pt-section pt-section--radar" aria-labelledby="ptH-radar" data-pt-section="radar">
                ${headHtml({
                    id: 'ptH-radar',
                    title: radar.title,
                    subtitle: radar.subtitle,
                    tools: `${playAllButton('radar', 'Reprodueix una cançó de cada artista')}${arrowTools}`,
                })}
                <ul class="pt-row pt-row--portraits">
                    ${radar.items.map(item => `<li class="pt-cell">${portraitHtml(item)}</li>`).join('')}
                </ul>
            </section>`;
    }

    function stylesHtml(styles, expanded) {
        if (!styles.length) return '';
        const secondary = styles.filter(style => !style.primary);
        const tile = (style, extra) => {
            const label = esc(style.label);
            const count = style.artists === 1 ? '1 artista' : `${style.artists} artistes`;
            return `
                <li class="pt-style-cell${extra ? ' pt-style-cell--extra' : ''}"${extra && !expanded ? ' hidden' : ''}>
                    <button type="button" class="pt-style" data-pt-style="${label}" aria-label="${label}, ${count}">
                        <span class="pt-style__faces" aria-hidden="true">${style.avatars
                            .map(
                                src =>
                                    `<img src="${esc(avatarUrl(src, 96))}" alt="" loading="lazy" decoding="async" width="28" height="28">`
                            )
                            .join('')}</span>
                        <span class="pt-style__label">${label}</span>
                        <span class="pt-style__count">${count}</span>
                    </button>
                </li>`;
        };
        return `
            <section class="pt-section pt-section--styles" aria-labelledby="ptH-styles" data-pt-section="styles">
                ${headHtml({
                    id: 'ptH-styles',
                    title: 'Tria el teu so',
                    subtitle: 'Cada estil obre les cançons dels seus artistes',
                })}
                <ul class="pt-styles" id="ptStyles">
                    ${styles
                        .filter(style => style.primary)
                        .map(style => tile(style, false))
                        .join('')}
                    ${secondary.map(style => tile(style, true)).join('')}
                </ul>
                ${
                    secondary.length
                        ? `<button type="button" class="pt-btn pt-btn--ghost pt-styles__toggle" data-pt-all-styles aria-expanded="${expanded}" aria-controls="ptStyles">${expanded ? 'Menys estils' : 'Tots els estils'}</button>`
                        : ''
                }
            </section>`;
    }

    function liveHtml(live, now) {
        return `
            <section class="pt-section pt-section--live" aria-labelledby="ptH-live" data-pt-section="live">
                ${headHtml({
                    id: 'ptH-live',
                    title: live.title,
                    subtitle: live.subtitle,
                    tools: `${playAllButton('live', 'Reprodueix les actuacions')}${arrowTools}`,
                })}
                <ul class="pt-row pt-row--wide">
                    ${live.videos.map(video => `<li class="pt-cell">${cardHtml(video, { wide: true, badge: 'Gravat en directe', now })}</li>`).join('')}
                </ul>
            </section>`;
    }

    function emptyHtml() {
        return `
            <section class="pt-state" role="status">
                <h2 class="pt-state__title">Encara no tenim música per mostrar</h2>
                <p class="pt-state__text">No hem pogut carregar el catàleg ara mateix. Comprova la connexió i torna-ho a provar.</p>
                <button type="button" class="pt-btn pt-btn--primary" data-pt-retry>Torna-ho a provar</button>
            </section>`;
    }

    function renderSections(model, options = {}) {
        if (model.status === 'empty') return `<div class="pt-sections">${emptyHtml()}</div>`;
        const now = options.now ?? Date.now();
        return `
            <div class="pt-sections">
                ${model.lead ? leadHtml(model.lead) : ''}
                ${model.fresh ? freshHtml(model.fresh, Boolean(options.freshExpanded), now, model.reasons) : ''}
                ${model.radar ? radarHtml(model.radar) : ''}
                ${stylesHtml(model.styles, Boolean(options.stylesExpanded))}
                ${model.live ? liveHtml(model.live, now) : ''}
            </div>`;
    }

    // ---------- Context real de l'app ----------

    function collectContext(input) {
        const discovery = app.features.discovery;
        const context = discovery.readAppContext();
        const feed = input.feed;
        let playlists = [];
        try {
            playlists = app.features.library?.getPlaylists?.() || [];
        } catch (error) {
            playlists = [];
        }
        const music = window.SegueixMusicCategories;
        const homeSections = app.features.homeSections;
        // Motor de selecció compartit (music-selection.js): mateixes senyals que la ràdio i el feed.
        const selection = app.features.musicSelection?.isEnabled?.() ? app.features.musicSelection : null;
        const classicArtist = music?.isClassicArtistVideo ? video => music.isClassicArtistVideo(video) : null;
        let selectionCtx = null;
        let signals = null;
        if (selection) {
            try {
                const catalog = toArray(input.all).length ? input.all : input.recent;
                selectionCtx = selection.getAppContext(catalog);
                signals = app.features.musicSignals?.snapshot?.() || selection.emptySignals();
            } catch (error) {
                selectionCtx = null;
            }
        }
        return {
            selection: selectionCtx ? selection : null,
            selectionCtx,
            signals,
            isRejected: signals
                ? video =>
                      signals.lessLike.has(String(video?.id)) ||
                      signals.blockedArtists.has(selectionCtx.artistKeyOf(video))
                : null,
            isCurrent: selectionCtx
                ? video =>
                      selection.eraOf(video, { now: selectionCtx.now, isClassicArtist: classicArtist }).tier !==
                      'historic'
                : null,
            isNewRelease: selectionCtx
                ? video => selection.isNewRelease(video, { now: selectionCtx.now, isClassicArtist: classicArtist })
                : null,
            discovery,
            recent: input.recent,
            all: input.all,
            channels: feed?.channels,
            history: context.history,
            liked: context.liked,
            followedIds: context.followedIds,
            hiddenIds: context.hiddenIds,
            playlists,
            isClip: video => Boolean(homeSections?.isOfficialClip?.(video)),
            isClassic: video =>
                typeof isHistoricVideo === 'function'
                    ? isHistoricVideo(video)
                    : Boolean(music?.isClassicVideo?.(video)),
        };
    }

    function signature() {
        const discovery = app.features.discovery;
        const context = discovery ? discovery.readAppContext() : { history: [] };
        let lists = 0;
        try {
            lists = (app.features.library?.getPlaylists?.() || []).reduce(
                (sum, list) => sum + 1 + toArray(list?.videos).length,
                0
            );
        } catch (error) {
            lists = 0;
        }
        // Les escoltes reals (music-signals) també refresquen «Torna-hi».
        const listened = app.features.musicSignals?.getStats?.()?.recent?.[0]?.id || '';
        return `${context.history.length}:${context.history[0]?.id || ''}:${context.liked.length}:${context.followedIds.length}:${lists}:${listened}`;
    }

    // ---------- DOM ----------

    const $ = id => window.document?.getElementById?.(id) || null;

    function remember(model) {
        state.registry.clear();
        const add = video => video?.id && state.registry.set(String(video.id), video);
        add(model.featured?.video);
        model.fresh?.all.forEach(add);
        model.radar?.items.forEach(item => add(item.video));
        model.live?.videos.forEach(add);
        model.lead?.items.forEach(item => item.type === 'song' && add(item.video));
    }

    function paint(input) {
        const discovery = app.features.discovery;
        const container = state.container;
        if (!discovery || !container) return false;
        const model = buildModel(collectContext(input));
        remember(model);
        state.model = model;
        state.featured = model.featured;
        container.innerHTML = renderSections(model, {
            freshExpanded: state.expanded.fresh,
            stylesExpanded: state.expanded.styles,
        });
        state.lastSignature = signature();
        state.rendered = true;
        container.removeAttribute('aria-busy');
        updateEntry();
        syncRowControls();
        return true;
    }

    // Refà només una secció (p. ex. en desplegar-la) perquè la resta de files no perdin el desplaçament.
    function swapSection(key, html) {
        const old = state.container?.querySelector?.(`[data-pt-section="${key}"]`);
        if (!old) return false;
        const template = window.document.createElement('template');
        template.innerHTML = html.trim();
        const fresh = template.content.firstElementChild;
        if (!fresh) return false;
        old.replaceWith(fresh);
        syncRowControls();
        return true;
    }

    // Retorna true si ha pintat la portada (si no, l'app fa servir la graella clàssica).
    function render(container, videos, options = {}) {
        if (!container || !app.features.discovery) return false;
        state.container = container;
        bind();
        state.lastInput = { recent: toArray(videos), all: toArray(options.all), feed: options.feed };
        const painted = paint(state.lastInput);
        if (painted) $('homePage')?.classList.add('is-portada');
        return painted;
    }

    // Si l'usuari ha escoltat coses mentre era a un altre lloc, en tornar a Inici es refà «Torna-hi».
    function refreshIfStale() {
        if (!state.rendered || !state.lastInput || signature() === state.lastSignature) return;
        // La graella pot mostrar una altra vista (p. ex. els resultats d'una cerca): si ja no hi ha la portada,
        // no es trepitja. En tornar a Inici, renderVideos() la pinta de nou.
        if (!state.container?.querySelector?.('.pt-sections')) return;
        const input = { ...state.lastInput };
        try {
            if (typeof filterOutWatchedVideos === 'function') {
                input.recent = filterOutWatchedVideos(input.recent) || input.recent;
            }
        } catch (error) {
            // Sense historial: es queda com estava
        }
        paint(input);
    }

    function syncRowControls() {
        state.container?.querySelectorAll?.('.pt-section').forEach(section => {
            const row = section.querySelector('.pt-row');
            if (!row) return;
            const max = row.scrollWidth - row.clientWidth - 2;
            section.querySelectorAll('.pt-arrow').forEach(button => {
                const forward = Number(button.dataset.ptScroll) > 0;
                const disabled = forward ? row.scrollLeft >= max : row.scrollLeft <= 2;
                button.disabled = disabled;
            });
        });
    }

    // ---------- Entrada (B): mode, destacat i «Ara sona» ----------

    function nowPlaying() {
        const player = $('videoPlayer');
        if (!player) return null;
        const id = String(player.dataset.playingVideoId || '');
        const mini = player.classList.contains('mini-player-active');
        if (!id || !mini) return null;
        const queue = app.features.musicQueue?.getState?.();
        let video = queue?.current && String(queue.current.id) === id ? queue.current : state.registry.get(id) || null;
        if (!video) {
            try {
                video =
                    [...toArray(currentFeedVideos), ...toArray(cachedAPIVideos)].find(
                        item => String(item?.id) === id
                    ) || null;
            } catch (error) {
                video = null;
            }
        }
        return {
            id,
            video,
            playing: player.dataset.playerState === '1',
            next: queue?.active ? queue.next : null,
            isRadio: Boolean(queue?.isRadio),
            title: video?.title || $('videoTitle')?.textContent?.trim() || 'Cançó',
        };
    }

    // «(+) com aquesta (−)»: dos cercles clicables que compten per a l'algorisme (excloents, reversibles).
    function prefsHtml(video) {
        const signals = app.features.musicSignals;
        const id = esc(video.id);
        return `<span class="pt-prefs" role="group" aria-label="Com aquesta cançó">
            <button type="button" class="pt-circle" data-pt-plus="${id}" aria-pressed="${signals.isMoreLike(video.id)}" aria-label="Més com aquesta" title="Més com aquesta">${ICONS.plus}</button>
            <span class="pt-prefs__label" aria-hidden="true">com aquesta</span>
            <button type="button" class="pt-circle" data-pt-minus="${id}" aria-pressed="${signals.isLessLike(video.id)}" aria-label="Menys com aquesta" title="Menys com aquesta">${ICONS.minus}</button>
        </span>`;
    }

    function featureHtml(now) {
        if (now) {
            const video = now.video;
            const title = esc(now.title);
            const artist = video ? esc(artistName(video)) : '';
            const image = video?.thumbnail || `https://i.ytimg.com/vi/${encodeURIComponent(now.id)}/hqdefault.jpg`;
            const next = now.next
                ? `<p class="pt-feature__next"><span>A continuació</span> ${esc(now.next.title || '')}${now.next.channelTitle ? ` · ${esc(now.next.channelTitle)}` : ''}</p>`
                : '';
            return `
                <article class="pt-feature pt-feature--now" aria-label="Ara sona">
                    <button type="button" class="pt-feature__media" data-pt-continue aria-label="Continua escoltant ${title}">
                        <img src="${esc(image)}" alt="" decoding="async" width="320" height="180">
                        <span class="pt-eq${now.playing ? ' is-playing' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>
                    </button>
                    <div class="pt-feature__body">
                        <p class="pt-eyebrow pt-eyebrow--now">Ara sona</p>
                        <h3 class="pt-feature__title">${title}</h3>
                        ${artist ? `<button type="button" class="pt-artist" data-pt-artist="${esc(video.channelId)}" aria-label="Obre l’artista: ${artist}">${artist}</button>` : ''}
                        ${next}
                        <div class="pt-feature__actions">
                            <button type="button" class="pt-btn pt-btn--primary pt-btn--sm" data-pt-continue>Continua</button>
                            <button type="button" class="pt-act" data-pt-toggle aria-label="${now.playing ? 'Pausa' : 'Reprèn'}" title="${now.playing ? 'Pausa' : 'Reprèn'}">${now.playing ? ICONS.pause : ICONS.play}</button>
                            ${video && app.features.musicSignals ? prefsHtml(video) : ''}
                            ${now.isRadio ? `<button type="button" class="pt-tool" data-pt-regenerate title="Genera de nou la part pendent de la cua amb el mode triat">${ICONS.shuffle}<span>Regenera la cua</span></button>` : ''}
                        </div>
                    </div>
                </article>`;
        }
        const featured = state.featured;
        if (!featured) return '';
        const video = featured.video;
        const id = esc(video.id);
        const title = esc(video.title || 'Cançó');
        const artist = esc(artistName(video));
        const meta = publishedLabel(video);
        return `
            <article class="pt-feature" data-video-id="${id}">
                <button type="button" class="pt-feature__media" data-pt-play="${id}" aria-label="Reprodueix ${title}, de ${artist}">
                    <img src="${esc(video.thumbnail)}" alt="" decoding="async" fetchpriority="high" width="320" height="180">
                    <span class="pt-card__play" aria-hidden="true">${ICONS.play}</span>
                </button>
                <div class="pt-feature__body">
                    <p class="pt-eyebrow">${esc(featured.eyebrow)}</p>
                    <h3 class="pt-feature__title" data-pt-play="${id}">${title}</h3>
                    <button type="button" class="pt-artist" data-pt-artist="${esc(video.channelId)}" aria-label="Obre l’artista: ${artist}">${artist}</button>
                    ${meta ? `<p class="pt-card__meta">${esc(meta)}</p>` : ''}
                    <div class="pt-feature__actions">
                        <button type="button" class="pt-act" data-pt-queue="${id}" aria-label="Afegeix a la cua: ${title}" title="Afegeix a la cua">${ICONS.queue}</button>
                        <button type="button" class="pt-act" data-pt-save="${id}" aria-label="Desa en una llista: ${title}" title="Desa en una llista">${ICONS.save}</button>
                    </div>
                </div>
            </article>`;
    }

    function updateEntry() {
        const slot = $('ptFeature');
        const now = nowPlaying();
        const entry = $('portadaEntry');
        entry?.classList.toggle('is-now-playing', Boolean(now));
        if (slot) {
            const html = featureHtml(now);
            if (slot._html !== html) {
                slot.innerHTML = html;
                slot._html = html;
            }
        }
        const play = $('ptPlayBtn');
        if (play) {
            const ready = Boolean(state.model && state.model.status === 'ready');
            play.disabled = !ready;
            entry?.setAttribute('aria-busy', ready ? 'false' : 'true');
        }
        // «Continua la ràdio»: només si n'hi ha una de recent i ara no sona res; mai sona sola.
        const resume = $('ptResumeBtn');
        if (resume) {
            const last = !now && state.model?.status === 'ready' ? app.features.musicQueue?.getLastRadio?.() : null;
            resume.hidden = !last;
            const label = resume.querySelector('span');
            if (last && label) label.textContent = `Continua la ràdio: ${last.title || 'l’última cançó'}`;
        }
        syncModeInputs();
    }

    function syncModeInputs() {
        const discovery = app.features.discovery;
        if (!discovery) return;
        const mode = discovery.getMode();
        window.document?.querySelectorAll?.('input[name="ptMode"]').forEach(input => {
            input.checked = input.value === mode;
        });
        const hint = $('ptModeHint');
        if (hint) hint.textContent = discovery.MODES.find(item => item.id === mode)?.hint || '';
    }

    function setNote(text) {
        const note = $('ptNote');
        if (note) note.textContent = text || '';
    }

    function toast(message, options) {
        app.features.shellNav?.toast?.(message, options);
    }

    // ---------- Accions ----------

    function videoById(id) {
        const key = String(id);
        if (state.registry.has(key)) return state.registry.get(key);
        try {
            return (
                [...toArray(currentFeedVideos), ...toArray(cachedAPIVideos)].find(item => String(item?.id) === key) ||
                null
            );
        } catch (error) {
            return null;
        }
    }

    function playVideo(id) {
        if (typeof playThenNavigate === 'function') playThenNavigate(String(id), 'api');
    }

    function startMix() {
        const queue = app.features.musicQueue;
        if (!queue?.startDiscovery) return;
        const result = queue.startDiscovery();
        if (!result.started) {
            toast('Encara no hi ha música carregada. Torna-ho a provar d’aquí a un moment.');
            return;
        }
        if (result.note) toast(result.note, { duration: 7000 });
    }

    function enqueue(id) {
        const video = videoById(id);
        const queue = app.features.musicQueue;
        if (!video || !queue?.enqueue) return;
        const result = queue.enqueue(video);
        const title = video.title || 'La cançó';
        const messages = {
            queued: `«${title}» sonarà després de la que sona`,
            pending: `«${title}» és a la cua i sonarà quan facis sonar una cançó`,
            exists: `«${title}» ja és a la cua`,
            unsupported: 'Ara sona una llista: desa la cançó en una llista per afegir-la-hi',
        };
        toast(messages[result.status] || messages.unsupported);
    }

    function save(id) {
        const video = videoById(id);
        if (!video || typeof openPlaylistModal !== 'function') return;
        const payload = typeof getPlaylistVideoData === 'function' ? getPlaylistVideoData(video) : video;
        openPlaylistModal(payload);
    }

    function playSelection(key) {
        const model = state.model;
        const queue = app.features.musicQueue;
        if (!model || !queue?.playSelection) return;
        const sources = {
            fresh: { videos: model.fresh?.all.slice(0, FRESH_ROW) || [], label: 'Acabades de sortir' },
            radar: {
                videos: model.radar?.items.map(item => item.video) || [],
                label: model.radar?.title || 'Per descobrir',
            },
            live: { videos: model.live?.videos || [], label: 'En directe' },
        };
        const picked = sources[key];
        if (!picked || !queue.playSelection(picked.videos, picked.label)) {
            toast('No s’ha pogut engegar la selecció ara mateix.');
        }
    }

    function openStyle(label) {
        const chip = Array.from(window.document.querySelectorAll('.chips-bar .chip[data-cat]')).find(
            item => item.dataset.cat === label
        );
        if (!chip) return;
        chip.click();
        window.scrollTo?.({ top: 0 });
    }

    function scrollRow(button) {
        const row = button.closest('.pt-section')?.querySelector('.pt-row');
        if (!row) return;
        row.scrollBy({
            left: Number(button.dataset.ptScroll) * row.clientWidth * 0.85,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
    }

    function onClick(event) {
        const target = event.target;
        const pick = selector => target.closest?.(selector);
        let el;
        if ((el = pick('[data-pt-queue]'))) return enqueue(el.dataset.ptQueue);
        if ((el = pick('[data-pt-save]'))) return save(el.dataset.ptSave);
        if ((el = pick('[data-pt-artist]'))) {
            if (typeof openChannelProfile === 'function') openChannelProfile(el.dataset.ptArtist);
            return undefined;
        }
        if ((el = pick('[data-pt-play-all]'))) return playSelection(el.dataset.ptPlayAll);
        if ((el = pick('[data-pt-play]'))) return playVideo(el.dataset.ptPlay);
        if ((el = pick('[data-pt-list]'))) {
            if (typeof startPlaylistPlayback === 'function') startPlaylistPlayback(el.dataset.ptList);
            return undefined;
        }
        if ((el = pick('[data-pt-scroll]'))) return scrollRow(el);
        if ((el = pick('[data-pt-style]'))) return openStyle(el.dataset.ptStyle);
        if ((el = pick('[data-pt-all-styles]'))) {
            state.expanded.styles = !state.expanded.styles;
            swapSection('styles', stylesHtml(state.model.styles, state.expanded.styles));
            state.container.querySelector('[data-pt-all-styles]')?.focus?.({ preventScroll: true });
            return undefined;
        }
        if ((el = pick('[data-pt-more]'))) {
            state.expanded.fresh = !state.expanded.fresh;
            swapSection('fresh', freshHtml(state.model.fresh, state.expanded.fresh, Date.now(), state.model.reasons));
            state.container.querySelector('[data-pt-more="fresh"]')?.focus?.({ preventScroll: true });
            return undefined;
        }
        if (pick('[data-pt-history]')) {
            window.document.querySelector('.nav-trigger[data-page="historial"]')?.click();
            return undefined;
        }
        if (pick('[data-pt-retry]')) {
            setNote('');
            if (typeof loadVideosFromAPI === 'function') loadVideosFromAPI();
            return undefined;
        }
        if ((el = pick('[data-pt-plus]') || pick('[data-pt-minus]'))) {
            const video = videoById(el.dataset.ptPlus || el.dataset.ptMinus);
            app.features.musicQueue?.applyPreference?.(video, el.dataset.ptPlus ? 'more' : 'less');
            return undefined;
        }
        if (pick('[data-pt-resume]')) {
            if (!app.features.musicQueue?.resumeLast?.())
                toast('No s’ha pogut continuar la ràdio. Prova «La teva ràdio».');
            return undefined;
        }
        if (pick('[data-pt-mix]')) return startMix();
        if (pick('[data-pt-continue]')) {
            window.document.querySelector('#videoPlayer .expand-mini-player-btn')?.click();
            return undefined;
        }
        if (pick('[data-pt-toggle]')) {
            if (typeof toggleMainPlayerPlayback === 'function') toggleMainPlayerPlayback();
            return undefined;
        }
        if (pick('[data-pt-regenerate]')) {
            app.features.musicQueue?.regenerate?.();
            toast('Cua generada de nou amb el mode triat');
            return undefined;
        }
        return undefined;
    }

    // Fletxes esquerra/dreta entre les cançons d'una fila.
    function onKeydown(event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const media = event.target.closest?.('.pt-card__media');
        if (!media) return;
        const cell = media.closest('.pt-cell');
        const sibling = event.key === 'ArrowRight' ? cell?.nextElementSibling : cell?.previousElementSibling;
        const next = sibling?.querySelector('.pt-card__media');
        if (next) {
            event.preventDefault();
            next.focus();
        }
    }

    function onModeChange(event) {
        const input = event.target;
        if (input?.name !== 'ptMode') return;
        const discovery = app.features.discovery;
        const mode = discovery.setMode(input.value);
        syncModeInputs();
        const label = discovery.MODES.find(item => item.id === mode)?.label || '';
        // Canviar el selector no toca la cançó que sona: només s'aplica en engegar o regenerar la cua.
        const now = nowPlaying();
        setNote(
            now
                ? `«${label}» s’aplicarà quan facis sonar una ràdio nova o regeneris la cua. No s’interromp res.`
                : `Preferència desada: «${label}».`
        );
    }

    function bind() {
        if (state.bound) return;
        state.bound = true;
        const entry = $('portadaEntry');
        [state.container, entry].forEach(root => {
            root?.addEventListener('click', onClick);
            root?.addEventListener('keydown', onKeydown);
        });
        entry?.addEventListener('change', onModeChange);
        state.container.addEventListener('scroll', () => syncRowControls(), { capture: true, passive: true });
        window.addEventListener('resize', () => syncRowControls(), { passive: true });
        window.addEventListener('segueix:queue-changed', updateEntry);
        window.addEventListener('segueix:discovery-mode-changed', syncModeInputs);
        window.addEventListener('segueix:music-prefs-changed', updateEntry);
        observeLive();
    }

    // La portada només és a Inici (Novetats): en canviar d'estil la resta de la pàgina torna a ser la de sempre.
    function syncActiveClass() {
        const home = $('homePage');
        if (!home) return;
        let category = 'Novetats';
        try {
            category = selectedCategory;
        } catch (error) {
            // app.js encara no ha carregat
        }
        home.classList.toggle('is-portada', category === 'Novetats');
    }

    // Reacciona al reproductor (pausa, cançó nova, finestreta) i al fet de tornar a Inici.
    function observeLive() {
        if (typeof window.MutationObserver !== 'function') return;
        let raf = 0;
        const schedule = () => {
            if (raf) return;
            raf = window.requestAnimationFrame(() => {
                raf = 0;
                updateEntry();
            });
        };
        const player = $('videoPlayer');
        if (player) {
            new window.MutationObserver(schedule).observe(player, {
                attributes: true,
                attributeFilter: ['class', 'data-player-state', 'data-playing-video-id'],
            });
        }
        const title = $('videoTitle');
        if (title) {
            new window.MutationObserver(schedule).observe(title, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        }
        const chips = window.document.querySelector('.chips-bar');
        if (chips) {
            new window.MutationObserver(syncActiveClass).observe(chips, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class'],
            });
        }
        const home = $('homePage');
        if (home) {
            new window.MutationObserver(() => {
                if (!home.classList.contains('hidden')) {
                    refreshIfStale();
                    schedule();
                }
            }).observe(home, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // Si passen uns segons i encara no hi ha res (sense xarxa, API caiguda), es mostra l'estat d'error.
    function watchLoading() {
        window.setTimeout(() => {
            const grid = $('videosGrid');
            if (state.rendered || !grid || !grid.querySelector('.pt-skeleton')) return;
            grid.innerHTML = emptyHtml();
            grid.removeAttribute('aria-busy');
            state.container = grid;
            bind();
        }, 15000);
    }

    function init() {
        state.container = $('videosGrid');
        if (!state.container) return;
        bind();
        syncModeInputs();
        updateEntry();
        watchLoading();
    }

    if (window.document?.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', init);
    } else if (window.document) {
        init();
    }

    app.features.portada = {
        render,
        buildModel,
        renderSections,
        cardHtml,
        publishedLabel,
        avatarUrl,
        esc,
        toast,
        updateEntry,
        refreshIfStale,
        isActive: () => state.rendered,
        getModel: () => state.model,
    };
})(window);
