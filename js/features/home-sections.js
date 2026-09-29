// Seccions horitzontals de la pàgina principal (estil YouTube Music / Spotify).
// Implementació directa: es renderitza dins #videosGrid quan la categoria és "Novetats".
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const ROW_SIZE = 16;
    const MIN_ROW_ITEMS = 4;
    const TOP_STYLES = 3;
    // Estils per defecte quan encara no hi ha prou historial. 'Pop / Rock' agrupa les dues categories.
    const DEFAULT_STYLES = ['Urbana', 'Pop / Rock', "Cançó d'autor"];
    const COMBINED_STYLES = { 'Pop / Rock': ['Pop', 'Rock'] };
    const POPULAR_WINDOW_DAYS = 21;
    const STYLE_ROWS = [
        'Pop',
        'Rock',
        'Indie',
        'Urbana',
        'Rap / Hip-hop',
        'Folk i arrel',
        "Cançó d'autor",
        'Electrònica',
        'Ska / Reggae',
        'Rumba / Mestissatge',
        'Punk / Metal',
        'Jazz / Blues',
    ];

    const ARROW_LEFT = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m15 6-6 6 6 6"/></svg>';
    const ARROW_RIGHT = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6"/></svg>';

    function escapeText(value) {
        const div = document.createElement('div');
        div.textContent = String(value);
        return div.innerHTML;
    }

    // Videoclips oficials: cançons amb marca explícita de videoclip / vídeo oficial al títol
    // (o marcades així pel classificador del feed). Exclou portades (covers), lyrics, àudios
    // amb imatge fixa, directes, versions, karaokes, remixos, teasers i contingut auxiliar.
    const OFFICIAL_CLIP_RE =
        /(v[ií]deo\s*-?\s*clip|clip\s+oficial|official\s+(music\s+)?video|official\s+clip|v[ií]deo\s+oficial|[(\[]\s*(oficial|official)\s*[)\]]|official\s+mv)/i;
    const NOT_OFFICIAL_CLIP_RE =
        /(cover|versi[óo]|karaoke|lyric|letra|lletra|audio|àudio|en\s+directe|\blive\b|ac[uú]stic|reacci|making\s+of|teaser|tr[àa]iler|entrevista|podcast|remix|sessi[óo]|behind|darrere|shorts?\b|#shorts)/i;

    function isOfficialClip(video) {
        if (!video || video.isShort) return false;
        if (video.contentType && video.contentType !== 'song') return false;
        const title = String(video.title || '');
        // Ho descartem tot i que el títol digui "oficial" si té marques de cover/directe/lyric...
        if (NOT_OFFICIAL_CLIP_RE.test(title.replace(/official\s+audio/gi, 'audio'))) return false;
        if (/provided to youtube by/i.test(String(video.description || ''))) return false; // pistes Topic (imatge fixa)
        const seconds = Number(video.durationSeconds) || 0;
        if (seconds && (seconds < 100 || seconds > 720)) return false;
        if (OFFICIAL_CLIP_RE.test(title)) return true;
        return /marcador expl[ií]cit/i.test(String(video.musicReason || '')) && /video|v[ií]deo|clip/i.test(title);
    }

    function timestampOf(video) {
        return new Date(video?.publishedAt || video?.uploadDate || 0).getTime() || 0;
    }

    // Intercala canals perquè una fila no la copi un sol creador.
    function limitPerChannel(videos, maxPerChannel) {
        const counts = new Map();
        return videos.filter(video => {
            const key = String(video.channelId || '');
            const count = counts.get(key) || 0;
            if (count >= maxPerChannel) return false;
            counts.set(key, count + 1);
            return true;
        });
    }

    function buildStyleRow(videos, feed, category) {
        const channels = new Map();
        (Array.isArray(feed?.channels) ? feed.channels : []).forEach(channel => {
            const cats = Array.isArray(channel.categories) ? channel.categories.map(c => String(c).toLowerCase()) : [];
            channels.set(channel.id, cats);
        });
        const wanted = (COMBINED_STYLES[category] || [category]).map(name => name.toLowerCase());
        const music = window.SegueixMusicCategories;
        const matches = videos.filter(video => {
            if (music?.isCategoryEligibleVideo && !music.isCategoryEligibleVideo(video)) return false;
            const cats = channels.get(video.channelId) || [];
            return wanted.some(name => cats.includes(name));
        });
        return limitPerChannel(matches, 2).slice(0, ROW_SIZE);
    }

    // Estils que l'usuari més escolta: historial (1 punt) i M'agrada (2 punts), via categories del canal.
    function getTopStyles(feed, count) {
        const channelCats = new Map();
        (Array.isArray(feed?.channels) ? feed.channels : []).forEach(channel => {
            channelCats.set(
                String(channel.id),
                (Array.isArray(channel.categories) ? channel.categories : []).map(c => String(c).toLowerCase())
            );
        });
        const byLower = new Map(STYLE_ROWS.map(name => [name.toLowerCase(), name]));
        const scores = new Map();
        const add = (video, points) => {
            if (!video || video.isShort) return;
            const cats = channelCats.get(String(video.channelId)) || [];
            const own = Array.isArray(video.categories) ? video.categories.map(c => String(c).toLowerCase()) : [];
            new Set([...cats, ...own]).forEach(cat => {
                const style = byLower.get(cat);
                if (style) scores.set(style, (scores.get(style) || 0) + points);
            });
        };
        try {
            (typeof getHistoryItems === 'function' ? getHistoryItems() : []).forEach(video => add(video, 1));
        } catch (error) {
            // Sense historial
        }
        try {
            (typeof getLikedVideos === 'function' ? getLikedVideos() : []).forEach(video => add(video, 2));
        } catch (error) {
            // Sense m'agrada
        }
        return [...scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([style]) => style)
            .slice(0, count);
    }

    // Vídeos candidats per a les files d'estil: tot el feed (no només la finestra de novetats),
    // sense Shorts ni canals amagats.
    function getStylePool(videos, allVideos) {
        if (!Array.isArray(allVideos) || allVideos.length === 0) return videos;
        let hidden = new Set();
        try {
            hidden = new Set((typeof getHiddenChannelIds === 'function' ? getHiddenChannelIds() : []).map(String));
        } catch (error) {
            // Sense canals amagats
        }
        return allVideos.filter(video => video?.id && !video.isShort && !hidden.has(String(video.channelId || '')));
    }

    function buildSections(videos, feed, allVideos) {
        const stylePool = getStylePool(videos, allVideos).sort((a, b) => timestampOf(b) - timestampOf(a));
        const byDate = [...videos].sort((a, b) => timestampOf(b) - timestampOf(a));
        const sections = [];

        const latest = limitPerChannel(byDate, 2).slice(0, ROW_SIZE);
        if (latest.length >= MIN_ROW_ITEMS) {
            sections.push({ title: 'Últimes novetats', videos: latest });
        }

        const clips = limitPerChannel(stylePool.filter(isOfficialClip), 2).slice(0, ROW_SIZE);
        if (clips.length >= MIN_ROW_ITEMS) {
            sections.push({ title: 'Videoclips oficials', subtitle: 'Només videoclips dels artistes', videos: clips });
        }

        const cutoff = Date.now() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const popular = limitPerChannel(
            byDate
                .filter(video => timestampOf(video) >= cutoff)
                .sort((a, b) => Number(b.viewCount || b.views || 0) - Number(a.viewCount || a.views || 0)),
            2
        ).slice(0, ROW_SIZE);
        if (popular.length >= MIN_ROW_ITEMS) {
            sections.push({ title: 'El més escoltat', subtitle: 'Últimes setmanes', videos: popular });
        }

        // Els 3 estils que més escolta l'usuari sempre hi són (si no n'hi ha prou, s'omple amb els per defecte).
        const topStyles = [];
        const styleRows = new Map();
        const styleList = category => {
            if (!styleRows.has(category)) styleRows.set(category, buildStyleRow(stylePool, feed, category));
            return styleRows.get(category);
        };
        [...getTopStyles(feed, TOP_STYLES), ...DEFAULT_STYLES, ...STYLE_ROWS].forEach(category => {
            const parts = COMBINED_STYLES[category] || [];
            const overlaps =
                parts.some(name => topStyles.includes(name)) ||
                topStyles.some(item => (COMBINED_STYLES[item] || []).includes(category));
            if (
                topStyles.length < TOP_STYLES &&
                !topStyles.includes(category) &&
                !overlaps &&
                styleList(category).length > 0
            ) {
                topStyles.push(category);
            }
        });
        topStyles.forEach(category => {
            sections.push({
                title: category,
                subtitle: 'Dels teus estils',
                category,
                videos: styleList(category),
            });
        });

        STYLE_ROWS.forEach(category => {
            if (topStyles.includes(category)) return;
            // Pop i Rock ja surten dins la fila combinada.
            if (topStyles.includes('Pop / Rock') && COMBINED_STYLES['Pop / Rock'].includes(category)) return;
            const list = styleList(category);
            if (list.length >= MIN_ROW_ITEMS) {
                sections.push({ title: category, category, videos: list });
            }
        });
        return sections;
    }

    function renderSection(section, index, createCard) {
        const more = section.category
            ? `<button type="button" class="home-section-more" data-open-category="${escapeText(section.category)}">Veure-ho tot</button>`
            : '';
        return `
            <section class="home-section" data-section-index="${index}">
                <header class="home-section-header">
                    <div class="home-section-heading">
                        <h2 class="home-section-title">${escapeText(section.title)}</h2>
                        ${section.subtitle ? `<span class="home-section-subtitle">${escapeText(section.subtitle)}</span>` : ''}
                    </div>
                    <div class="home-section-controls">
                        ${more}
                        <button type="button" class="home-section-arrow" data-scroll="-1" aria-label="Anterior">${ARROW_LEFT}</button>
                        <button type="button" class="home-section-arrow" data-scroll="1" aria-label="Següent">${ARROW_RIGHT}</button>
                    </div>
                </header>
                <div class="home-section-row">${section.videos.map(createCard).join('')}</div>
            </section>
        `;
    }

    function bindControls(wrapper) {
        wrapper.addEventListener('click', event => {
            const arrow = event.target.closest('.home-section-arrow');
            if (arrow) {
                const row = arrow.closest('.home-section').querySelector('.home-section-row');
                row.scrollBy({ left: Number(arrow.dataset.scroll) * row.clientWidth * 0.85, behavior: 'smooth' });
                return;
            }
            const more = event.target.closest('[data-open-category]');
            if (more) {
                const requested = more.dataset.openCategory;
                const category = COMBINED_STYLES[requested]?.[0] || requested;
                const chip = Array.from(document.querySelectorAll('.chips-bar .chip[data-cat]')).find(
                    item => item.dataset.cat === category
                );
                chip?.click();
                window.scrollTo?.({ top: 0 });
            }
        });
    }

    // Retorna true si ha renderitzat seccions (si no, l'app fa servir la graella clàssica).
    function render(container, videos, options = {}) {
        if (!container || typeof createVideoCardAPI !== 'function') return false;
        const sections = buildSections(Array.isArray(videos) ? videos : [], options.feed, options.all);
        if (sections.length === 0) return false;

        const wrapper = document.createElement('div');
        wrapper.className = 'home-sections';
        wrapper.innerHTML = sections.map((section, index) => renderSection(section, index, createVideoCardAPI)).join('');
        bindControls(wrapper);

        container.innerHTML = options.prepend || '';
        container.appendChild(wrapper);
        return true;
    }

    app.features.homeSections = { render, buildSections, isOfficialClip };
})(window);
