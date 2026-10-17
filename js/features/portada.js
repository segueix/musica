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
        // Estils triats a la targeta de la primera vegada (encara sense desar)
        firstPick: new Set(),
        // «Més estils» desplegat a la targeta de la primera vegada
        firstMore: false,
    };

    // ---------- Utilitats pures ----------

    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);
    const toArray = value => (Array.isArray(value) ? value : []);

    // Les fotos de perfil de YouTube porten la mida a la URL (=s800-c...): en demanem una de prou petita.
    function avatarUrl(url, size = 240) {
        const value = cardThumbnail(url, size <= 120);
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
    function* buildModelSteps(ctx = {}) {
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

        yield;
        // B · novetat destacada de l'entrada
        const featured = discovery.pickFeatured({
            videos: newest.length ? newest : recent.length ? recent : all,
            profile,
            isClip: ctx.isClip,
            isNew,
            now,
        });
        // No es «pren»: la destacada ja no es pinta com a targeta (només dona una caràtula al collage de «La teva
        // ràdio»). Abans es treia d'«Acabades de sortir», i com que es tria pel gust (artista conegut, videoclip),
        // la novetat que faltava a la fila canviava a mesura que l'usuari escoltava.
        if (featured) model.featured = featured;

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

        yield;
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

        yield;
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

        yield;
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

        yield;
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

        yield;
        // F · estils reals i les teves categories (user-categories.js), en l'ordre que hagis triat arrossegant
        model.styleBase = discovery.summarizeStyles({ videos: all, channels });
        model.styles = arrangeStyles(model.styleBase, ctx.userCategories, ctx.styleOrder, channels);

        yield;
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

    function buildModel(ctx = {}) {
        const steps = buildModelSteps(ctx);
        let step = steps.next();
        while (!step.done) step = steps.next();
        return step.value;
    }

    async function yieldToBrowser() {
        if (window.scheduler?.yield) await window.scheduler.yield();
        else await new Promise(resolve => window.setTimeout(resolve, 0));
    }

    async function buildModelAsync(ctx = {}) {
        const steps = buildModelSteps(ctx);
        let step = steps.next();
        while (!step.done) {
            await yieldToBrowser();
            step = steps.next();
        }
        return step.value;
    }

    // Estils + categories pròpies en l'ordre desat. Sense el mòdul de categories, només els estils.
    function arrangeStyles(base, userCategories, order, channels) {
        const uc = app.features.userCategories;
        if (!uc?.arrangeTiles) return toArray(base);
        return uc.arrangeTiles(toArray(base), uc.tilesFor(toArray(userCategories), { channels }), order || null);
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
                    <img src="${esc(cardThumbnail(video.thumbnail))}" alt="" loading="lazy" decoding="async" width="320" height="180">
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
            ? `<img src="${esc(avatarUrl(item.avatar, 400))}" alt="" loading="lazy" decoding="async" width="240" height="240">`
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
                            ? `<img src="${esc(avatarUrl(item.image, 400))}" alt="" loading="lazy" decoding="async" width="200" height="200">`
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
                    ? `<span class="pt-quick__mosaic">${images.map(src => `<img src="${esc(cardThumbnail(src, true))}" alt="" loading="lazy" decoding="async">`).join('')}</span>`
                    : images.length
                      ? `<img src="${esc(cardThumbnail(images[0], true))}" alt="" loading="lazy" decoding="async">`
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
                <span class="pt-quick__thumb"><img src="${esc(cardThumbnail(item.image, true))}" alt="" loading="lazy" decoding="async" width="200" height="200"></span>
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

    // «Tots els estils»: una rajola més de la graella, al costat de «Crea una categoria»
    const ICON_GRID =
        '<svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor"/><rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor"/><rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor"/><rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor"/></svg>';
    const ICON_LESS =
        '<svg viewBox="0 0 24 24" focusable="false"><path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function stylesHtml(styles, expanded) {
        if (!styles.length) return '';
        const secondary = styles.filter(style => !style.primary);
        const tile = (style, extra) => {
            const label = esc(style.label);
            const count =
                style.artists === 1 ? '1 artista' : style.artists ? `${style.artists} artistes` : 'Sense artistes';
            const kind = style.user ? 'La teva categoria' : 'Estil';
            return `
                <li class="pt-style-cell${extra ? ' pt-style-cell--extra' : ''}${style.user ? ' pt-style-cell--user' : ''}"${extra && !expanded ? ' hidden' : ''}>
                    <button type="button" class="pt-style${style.user ? ' pt-style--user' : ''}" data-pt-style="${label}" aria-label="${kind}: ${label}, ${count}. Alt i fletxes per moure-la">
                        ${style.user ? '<span class="pt-style__kind">La teva</span>' : ''}
                        <span class="pt-style__faces" aria-hidden="true">${style.avatars
                            .map(
                                src =>
                                    `<img src="${esc(avatarUrl(src, 240))}" alt="" loading="lazy" decoding="async" width="120" height="120">`
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
                    subtitle:
                        'Cada estil obre les cançons dels seus artistes. Mantén premut un estil i arrossega’l per canviar-ne l’ordre.',
                })}
                <ul class="pt-styles" id="ptStyles">
                    ${styles
                        .filter(style => style.primary)
                        .map(style => tile(style, false))
                        .join('')}
                    ${secondary.map(style => tile(style, true)).join('')}
                    <li class="pt-style-cell pt-style-cell--add pt-style-cell--actions">
                        ${
                            secondary.length
                                ? `<button type="button" class="pt-style pt-style--more" data-pt-all-styles aria-expanded="${expanded}" aria-controls="ptStyles">
                            <span class="pt-style__plus pt-style__plus--more" aria-hidden="true">${expanded ? ICON_LESS : ICON_GRID}</span>
                            <span class="pt-style__label">${expanded ? 'Menys estils' : 'Tots els estils'}</span>
                            <span class="pt-style__count">${expanded ? 'Plega la llista' : `+${secondary.length} estils més`}</span>
                        </button>`
                                : ''
                        }
                        <button type="button" class="pt-style pt-style--add" data-uc-create>
                            <span class="pt-style__plus" aria-hidden="true">+</span>
                            <span class="pt-style__label">Crea una categoria</span>
                            <span class="pt-style__count">Els teus grups</span>
                        </button>
                    </li>
                </ul>
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
                ${app.features.nearbyRadio?.cardHtml?.() || ''}
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
                      (selectionCtx.features.get(String(video?.id))?.era ||
                          selection.eraOf(video, { now: selectionCtx.now, isClassicArtist: classicArtist, config: selectionCtx.config })).tier !==
                      'historic'
                : null,
            isNewRelease: selectionCtx
                ? video => selection.isNewRelease(video, { now: selectionCtx.now, isClassicArtist: classicArtist, config: selectionCtx.config })
                : null,
            discovery,
            recent: input.recent,
            all: input.all,
            channels: feed?.channels,
            userCategories: app.features.userCategories?.list?.() || [],
            styleOrder: app.features.userCategories?.getHomeOrder?.() || null,
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

    let paintRevision = 0;

    async function paint(input) {
        const discovery = app.features.discovery;
        const container = state.container;
        if (!discovery || !container) return false;
        const revision = ++paintRevision;
        const previousContent = container.firstElementChild;
        const isCurrent = () => revision === paintRevision && state.container === container &&
            container.firstElementChild === previousContent &&
            (typeof selectedCategory === 'undefined' || selectedCategory === 'Novetats');
        container.setAttribute('aria-busy', 'true');
        try {
            // Deixa acabar la tasca del feed; cada fila cedeix després el fil.
            await yieldToBrowser();
            if (!isCurrent()) return false;
            const model = await buildModelAsync(collectContext(input));
            // Una cerca, un estil o un render més recent poden haver ocupat la graella.
            if (!isCurrent()) return false;
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
            // Primera pintada: ara ja es pot veure Inici (fins aquí, l'HTML de mostra quedava amagat)
            $('homePage')?.classList.remove('is-booting');
            syncRowControls();
            setupStyleSorting();
            return true;
        } catch (error) {
            if (isCurrent()) {
                container.innerHTML = emptyHtml();
                console.warn('No s’ha pogut preparar la portada:', error);
            }
            return false;
        } finally {
            if (revision === paintRevision) container.removeAttribute('aria-busy');
        }
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
        setupStyleSorting();
        return true;
    }

    // ---------- Ordre manual de «Tria el teu so» ----------
    // Tàctil: mantenir premuda una rajola (250 ms) i arrossegar-la; ratolí: arrossegar; teclat: Alt + fletxes.
    // L'ordre es desa (user-categories.setHomeOrder) i també mana a la barra d'estils de les vistes d'estil.

    function styleLabelsFromDom(list) {
        return Array.from(list.querySelectorAll('.pt-style-cell:not(.pt-style-cell--add) [data-pt-style]')).map(
            button => button.dataset.ptStyle
        );
    }

    function saveStyleOrder(labels, focusLabel = '') {
        const uc = app.features.userCategories;
        if (!uc?.setHomeOrder || !state.model) return;
        uc.setHomeOrder(labels);
        const tiles = toArray(state.model.styles);
        state.model.styles = uc.arrangeTiles(
            tiles.filter(tile => !tile.user),
            tiles.filter(tile => tile.user),
            labels
        );
        swapSection('styles', stylesHtml(state.model.styles, state.expanded.styles));
        if (focusLabel) {
            Array.from(state.container?.querySelectorAll?.('#ptStyles [data-pt-style]') || [])
                .find(button => button.dataset.ptStyle === focusLabel)
                ?.focus?.({ preventScroll: true });
        }
    }

    function setupStyleSorting() {
        const list = state.container?.querySelector?.('#ptStyles');
        if (!list || list.dataset.ptSortable === '1' || typeof window.Sortable?.create !== 'function') return;
        list.dataset.ptSortable = '1';
        window.Sortable.create(list, {
            animation: 160,
            draggable: '.pt-style-cell:not(.pt-style-cell--add)',
            filter: '.pt-style-cell--add',
            preventOnFilter: false,
            ghostClass: 'is-ghost',
            chosenClass: 'is-chosen',
            dragClass: 'is-dragging',
            delay: 250,
            delayOnTouchOnly: true,
            touchStartThreshold: 6,
            onMove: event => !event.related?.classList?.contains('pt-style-cell--add'),
            onEnd: event => {
                if (event.oldIndex === event.newIndex) return;
                const labels = styleLabelsFromDom(list);
                // Repintar després que Sortable acabi de tocar el DOM.
                window.setTimeout(() => {
                    saveStyleOrder(labels);
                    toast('Has canviat l’ordre dels estils.');
                }, 0);
            },
        });
    }

    // Alt + fletxa (o Alt + Re Pàg / Av Pàg) mou la rajola enfocada un lloc enrere o endavant.
    function moveStyleWithKeyboard(event) {
        const button = event.target.closest?.('#ptStyles [data-pt-style]');
        if (!button || !event.altKey) return false;
        const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        if (!back && !forward) return false;
        const labels = styleLabelsFromDom(button.closest('#ptStyles'));
        const from = labels.indexOf(button.dataset.ptStyle);
        const to = from + (forward ? 1 : -1);
        event.preventDefault();
        if (from < 0 || to < 0 || to >= labels.length) return true;
        const [moved] = labels.splice(from, 1);
        labels.splice(to, 0, moved);
        saveStyleOrder(labels, moved);
        return true;
    }

    // Les categories pròpies han canviat (creades, esborrades, grups): es refà només «Tria el teu so».
    function refreshStyles() {
        const uc = app.features.userCategories;
        if (!uc || !state.model?.styleBase || !state.container?.querySelector?.('[data-pt-section="styles"]')) return;
        state.model.styles = arrangeStyles(
            state.model.styleBase,
            uc.list(),
            uc.getHomeOrder(),
            app.features.discovery?.normalizeChannels?.(state.lastInput?.feed?.channels) ||
                state.lastInput?.feed?.channels
        );
        swapSection('styles', stylesHtml(state.model.styles, state.expanded.styles));
    }

    // Retorna true si la portada es fa càrrec del render cooperatiu; false activa la graella clàssica.
    function render(container, videos, options = {}) {
        if (!container || !app.features.discovery) return false;
        state.container = container;
        bind();
        state.lastInput = { recent: toArray(videos), all: toArray(options.all), feed: options.feed };
        $('homePage')?.classList.add('is-portada');
        paint(state.lastInput);
        return true;
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

    let rowControlsFrame = 0;
    function syncRowControls() {
        if (rowControlsFrame) return;
        rowControlsFrame = window.requestAnimationFrame(() => {
            rowControlsFrame = 0;
            measureRowControls();
        });
    }

    function measureRowControls() {
        const updates = [];
        // Llegeix totes les mides abans de canviar cap atribut (evita recomposicions per filera).
        state.container?.querySelectorAll?.('.pt-section').forEach(section => {
            const bounds = section.getBoundingClientRect?.();
            if (bounds && (bounds.top > window.innerHeight + 200 || bounds.bottom < -200)) return;
            const row = section.querySelector('.pt-row');
            if (!row) return;
            const max = row.scrollWidth - row.clientWidth - 2;
            const left = row.scrollLeft;
            section.querySelectorAll('.pt-arrow').forEach(button => {
                const forward = Number(button.dataset.ptScroll) > 0;
                updates.push([button, forward ? left >= max : left <= 2]);
            });
        });
        updates.forEach(([button, disabled]) => {
            if (button.disabled !== disabled) button.disabled = disabled;
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

    // URL segura per a un `url('…')` de CSS dins un atribut style.
    function cssUrl(value) {
        const url = String(value || '').trim();
        if (!/^(https?:)?\/\//.test(url) && !url.startsWith('img/') && !url.startsWith('./')) return '';
        return encodeURI(url).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    }

    // Targeta «Continua escoltant»: la cançó que sona ara o, si no sona res, l'última ràdio que es va escoltar.
    // Porta la caràtula (grossa i, borrosa, de fons) perquè es vegi de seguida què es continua.
    //   now:  { id, video, playing, next, isRadio, title }   (ara sona)
    //   last: { video, title }                              (l'última ràdio, sense que soni)
    function continueHtml(now, last) {
        const playing = Boolean(now);
        const source = now || last;
        if (!source) return '';
        const video = source.video;
        const title = esc(source.title || video?.title || 'Cançó');
        const artist = video ? esc(artistName(video)) : '';
        const image =
            cardThumbnail(video?.thumbnail) || (now?.id ? `https://i.ytimg.com/vi/${encodeURIComponent(now.id)}/hqdefault.jpg` : '');
        const art = cssUrl(image);
        const next =
            playing && now.next
                ? `<p class="pt-feature__next"><span>A continuació</span> ${esc(now.next.title || '')}</p>`
                : '';
        const label = playing ? 'Ara sona' : 'Continua escoltant';
        const action = playing
            ? `<button type="button" class="pt-btn pt-btn--primary pt-btn--sm" data-pt-continue>Continua</button>
               <button type="button" class="pt-act" data-pt-toggle aria-label="${now.playing ? 'Pausa' : 'Reprèn'}" title="${now.playing ? 'Pausa' : 'Reprèn'}">${now.playing ? ICONS.pause : ICONS.play}</button>`
            : `<button type="button" class="pt-btn pt-btn--primary pt-btn--sm" id="ptResumeBtn" data-pt-resume>${ICONS.play}<span>Continua la ràdio</span></button>`;
        return `
            <article class="pt-feature ${playing ? 'pt-feature--now' : 'pt-feature--resume'}" aria-label="${label}"${art ? ` style="--pt-art: url('${art}')"` : ''}>
                <span class="pt-feature__bg" aria-hidden="true"></span>
                <button type="button" class="pt-feature__media" ${playing ? 'data-pt-continue' : 'data-pt-resume'} aria-label="${playing ? 'Torna a' : 'Continua'} ${title}">
                    ${image ? `<img src="${esc(image)}" alt="" decoding="async" width="320" height="180">` : ''}
                    ${playing ? `<span class="pt-eq${now.playing ? ' is-playing' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>` : `<span class="pt-card__play" aria-hidden="true">${ICONS.play}</span>`}
                </button>
                <div class="pt-feature__body">
                    <p class="pt-eyebrow pt-eyebrow--now">${label}</p>
                    <h3 class="pt-feature__title">${title}</h3>
                    ${artist ? `<button type="button" class="pt-artist" data-pt-artist="${esc(video.channelId)}" aria-label="Obre l’artista: ${artist}">${artist}</button>` : ''}
                    ${next}
                    <div class="pt-feature__actions">${action}</div>
                </div>
            </article>`;
    }

    // Caràtules del collage de «La teva ràdio» (fins a tres, de cançons diferents i d'artistes diferents).
    function radioCovers(videos, max = 3) {
        const seen = new Set();
        const out = [];
        for (const video of Array.isArray(videos) ? videos : []) {
            const image = video?.thumbnail;
            const artist = video ? String(video.channelId || video.channelTitle || '') : '';
            if (!image || seen.has(artist)) continue;
            seen.add(artist);
            out.push(video);
            if (out.length >= max) break;
        }
        return out;
    }

    function cardThumbnail(value, small = false) {
        return String(value || '').replace(/(https:\/\/i\.ytimg\.com\/vi\/[^/]+\/)maxresdefault\.jpg(?:\?.*)?$/, `$1${small ? 'mqdefault' : 'hqdefault'}.jpg`);
    }

    function coversHtml(videos) {
        const covers = radioCovers(videos);
        if (!covers.length) return '';
        // Cada caràtula va dins el seu requadre: fan de fons de la targeta en mosaic i es retallen sense franges negres
        return `<span class="pt-radio__covers">${covers
            .map(
                video =>
                    `<span class="pt-radio__cover"><img src="${esc(cardThumbnail(video.thumbnail))}" alt="" loading="eager" decoding="async" width="480" height="360"></span>`
            )
            .join('')}</span>`;
    }

    // ---------- «La teva ràdio»: gust recent i primera vegada ----------

    function tasteNow() {
        const discovery = app.features.discovery;
        if (!discovery?.recentTaste) return null;
        try {
            return discovery.recentTaste({ ...discovery.readAppContext() });
        } catch (error) {
            return null;
        }
    }

    // chooser: primera vegada de debò (cap dada i cap estil triat) → s'ensenyen els estils per triar.
    // savedOnly: ja va triar estils però encara no hi ha cap altra dada.
    function firstTimeState(taste) {
        const discovery = app.features.discovery;
        const saved = discovery?.getFirstStyles?.() || [];
        const empty = Boolean(taste && !taste.hasAny);
        // Amb molt poques dades (menys de 3 artistes coneguts) manen els estils triats: encara no hi ha gust que seguir.
        const thin = Boolean(taste && taste.artistKeys.size < (discovery?.MIN_KNOWN_ARTISTS || 3));
        return { saved, chooser: empty && saved.length === 0, savedOnly: thin && saved.length > 0 };
    }

    // Què diu la targeta de la ràdio: de què està feta (mai «des de zero»).
    function radioLead(taste, first, showsContinue) {
        if (first.chooser) return 'Tria fins a tres estils per començar.';
        if (first.savedOnly) {
            return `Feta amb els estils que vas triar: ${first.saved.join(', ')}. S’adaptarà al que escoltis.`;
        }
        const summary = taste?.hasAny ? app.features.discovery.tasteSummary(taste) : '';
        if (summary) return showsContinue ? `Una ràdio nova. ${summary}` : summary;
        return 'Barreja el que t’agrada amb música nova, sense parar.';
    }

    function syncFirstTime(first) {
        const box = $('ptFirst');
        const chips = $('ptFirstChips');
        const doc = window.document;
        if (box) box.hidden = !first.chooser;
        if (chips && first.chooser) {
            if (!chips.children.length) {
                const discovery = app.features.discovery;
                const main = new Set(toArray(discovery?.PRIMARY_STYLES));
                const chip = label =>
                    `<button type="button" class="pt-chip${main.has(label) ? '' : ' pt-chip--extra'}" data-pt-first-style="${esc(label)}" aria-pressed="false">${esc(label)}</button>`;
                chips.innerHTML = `${toArray(discovery?.choosableStyles?.()).map(chip).join('')}<button type="button" class="pt-chip pt-chip--more" data-pt-first-more aria-expanded="false">Més estils</button>`;
            }
            chips.querySelectorAll('[data-pt-first-style]').forEach(button => {
                const picked = state.firstPick.has(button.dataset.ptFirstStyle);
                button.setAttribute('aria-pressed', String(picked));
                // Els estils menys habituals surten sota «Més estils» (però no s'amaga el que ja s'ha triat)
                if (button.classList.contains('pt-chip--extra')) button.hidden = !state.firstMore && !picked;
            });
            const more = chips.querySelector('[data-pt-first-more]');
            if (more) {
                more.setAttribute('aria-expanded', String(state.firstMore));
                more.textContent = state.firstMore ? 'Menys estils' : 'Més estils';
            }
        }
        const mode = doc?.querySelector?.('#ptRadio .pt-mode');
        if (mode) mode.hidden = first.chooser || first.savedOnly;
        const reset = $('ptFirstReset');
        if (reset) reset.hidden = !first.savedOnly;
    }

    function toggleFirstStyle(label) {
        const max = app.features.discovery?.MAX_FIRST_STYLES || 3;
        if (state.firstPick.has(label)) state.firstPick.delete(label);
        else if (state.firstPick.size >= max) toast(`Pots triar-ne fins a ${max}.`);
        else state.firstPick.add(label);
        updateEntry();
    }

    function updateEntry() {
        const slot = $('ptFeature');
        const now = nowPlaying();
        const entry = $('portadaEntry');
        const ready = Boolean(state.model && state.model.status === 'ready');
        // L'última ràdio només s'ofereix si ara no sona res; mai sona sola.
        const lastRadio = !now && ready ? app.features.musicQueue?.getLastRadio?.() : null;
        const last = lastRadio
            ? { video: videoById(lastRadio.id), title: lastRadio.title || videoById(lastRadio.id)?.title || '' }
            : null;
        const showsContinue = Boolean(now || last?.video);
        entry?.classList.toggle('is-now-playing', Boolean(now));
        entry?.classList.toggle('has-continue', showsContinue);
        if (slot) {
            const html = continueHtml(now, last?.video ? last : null);
            if (slot._html !== html) {
                slot.innerHTML = html;
                slot._html = html;
            }
        }
        // «La teva ràdio»: collage de caràtules i un text que explica com es relaciona amb «Continua»
        const art = $('ptRadioArt');
        if (art) {
            const pool = [state.model?.featured?.video, ...(state.model?.fresh?.all || [])].filter(Boolean);
            const html = coversHtml(pool);
            if (art._html !== html) {
                art.innerHTML = html;
                art._html = html;
            }
        }
        // «La teva ràdio» es fa amb el gust recent (escoltat aquests dies, m'agrades i seguits). La primera vegada
        // —sense res d'això— es demanen els estils, i només aquesta vegada.
        const taste = tasteNow();
        const first = firstTimeState(taste);
        entry?.classList.toggle('is-first-time', first.chooser);
        const lead = $('ptRadioLead');
        if (lead) lead.textContent = radioLead(taste, first, showsContinue);
        syncFirstTime(first);
        const play = $('ptPlayBtn');
        if (play) {
            play.disabled = !ready || (first.chooser && state.firstPick.size === 0);
            play.title = first.chooser && state.firstPick.size === 0 ? 'Tria almenys un estil per començar' : '';
            const text = play.querySelector('span');
            if (text) text.textContent = showsContinue ? 'Ràdio nova' : 'Engega la ràdio';
            // Hi ha una acció principal a la pantalla: si ja es pot continuar, «Ràdio nova» és la secundària
            play.classList.toggle('pt-btn--primary', !showsContinue);
            play.classList.toggle('pt-btn--ghost', showsContinue);
            entry?.setAttribute('aria-busy', ready ? 'false' : 'true');
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
        // La primera vegada la ràdio es fa amb els estils triats: es desen i ja no es tornen a demanar.
        const first = firstTimeState(tasteNow());
        if (first.chooser) {
            if (!state.firstPick.size) {
                toast('Tria almenys un estil per començar.');
                return;
            }
            app.features.discovery.setFirstStyles([...state.firstPick]);
        }
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
        // Al mòbil, tocar qualsevol part d'una targeta de cançó (també el nom de l'artista) la reprodueix.
        if (typeof isMobileView === 'function' && isMobileView() && (el = pick('.pt-card[data-video-id]'))) {
            return playVideo(el.dataset.videoId);
        }
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
        if (pick('[data-pt-resume]')) {
            if (!app.features.musicQueue?.resumeLast?.())
                toast('No s’ha pogut continuar la ràdio. Prova «La teva ràdio».');
            return undefined;
        }
        if ((el = pick('[data-pt-first-style]'))) return toggleFirstStyle(el.dataset.ptFirstStyle);
        if (pick('[data-pt-first-more]')) {
            state.firstMore = !state.firstMore;
            updateEntry();
            return undefined;
        }
        if (pick('[data-pt-first-reset]')) {
            app.features.discovery?.setFirstStyles?.([]);
            state.firstPick = new Set();
            updateEntry();
            return undefined;
        }
        if (pick('[data-pt-mix]')) return startMix();
        if (pick('[data-pt-continue]')) {
            if (typeof expandMiniPlayer === 'function') expandMiniPlayer();
            return undefined;
        }
        if (pick('[data-pt-toggle]')) {
            if (typeof toggleMainPlayerPlayback === 'function') toggleMainPlayerPlayback();
            return undefined;
        }
        return undefined;
    }

    // Fletxes esquerra/dreta entre les cançons d'una fila.
    function onKeydown(event) {
        if (moveStyleWithKeyboard(event)) return;
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
        window.addEventListener('scroll', syncRowControls, { passive: true });
        window.addEventListener('segueix:queue-changed', updateEntry);
        window.addEventListener('segueix:discovery-mode-changed', syncModeInputs);
        window.addEventListener('segueix:music-prefs-changed', updateEntry);
        window.addEventListener('segueix:user-categories-changed', refreshStyles);
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
        buildModelAsync,
        renderSections,
        cardHtml,
        publishedLabel,
        avatarUrl,
        esc,
        toast,
        updateEntry,
        continueHtml,
        radioCovers,
        radioLead,
        firstTimeState,
        refreshIfStale,
        isActive: () => state.rendered,
        getModel: () => state.model,
    };
})(window);



