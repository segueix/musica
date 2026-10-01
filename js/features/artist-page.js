// Fitxa d'artista: les dues ràdios de dalt de tot, la foto gran amb el nom i la presentació curta que es pot
// expandir. Implementació directa (patró 2); el que no toca el DOM és pur i testable:
//  - artistStyles(): estils de l'artista (el principal primer) per a la «ràdio de l'estil»;
//  - radiosModel(): quines ràdios es poden engegar i amb quin text;
//  - bioModel(): presentació neta (sense text de farciment).
// La fitxa la pinta openChannelProfileLegacyImpl() (app.js), que crida showProfile() i setSongs().
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    // Vistes generals o «calaix» que no són un estil per a una ràdio.
    const EXCLUDED_STYLES = new Set(['altres estils', 'novetats', 'descobreix', 'seguint', 'tot']);
    // Una combinació de tres estils ja és una barreja prou àmplia; més la diluiria.
    const MAX_STYLES = 3;
    const MIN_SONGS = 2;

    const text = value => String(value ?? '').trim();

    // Estils de l'artista per a la ràdio d'estil: el principal (base d'artistes) primer, sense repetits ni vistes
    // generals, com a màxim MAX_STYLES. `labels`: noms canònics de les categories (el feed els pot dur en minúscules).
    function artistStyles({ categories = [], primary = '', labels = [] } = {}) {
        const canonical = new Map(
            (Array.isArray(labels) ? labels : []).map(label => [text(label).toLowerCase(), text(label)])
        );
        const seen = new Set();
        return [primary, ...(Array.isArray(categories) ? categories : [])]
            .map(text)
            .filter(Boolean)
            .map(name => canonical.get(name.toLowerCase()) || name)
            .filter(name => {
                const key = name.toLowerCase();
                if (EXCLUDED_STYLES.has(key) || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, MAX_STYLES);
    }

    // Cançons de l'artista que poden sonar en una ràdio (sense Shorts).
    function songsOf(videos) {
        return (Array.isArray(videos) ? videos : []).filter(video => video && video.id && !video.isShort);
    }

    // Estat de les dues ràdios: `loading` mentre encara no han arribat les cançons del canal.
    function radiosModel({ name = '', styles = [], songCount = 0, loading = false } = {}) {
        const artist = text(name) || 'l’artista';
        const list = Array.isArray(styles) ? styles : [];
        const artistReady = !loading && songCount >= MIN_SONGS;
        const styleReady = !loading && list.length > 0;
        return {
            artist: {
                enabled: artistReady,
                label: `Ràdio de ${artist}: només les seves cançons`,
                hint: artistReady
                    ? `Només cançons de ${artist}`
                    : loading
                      ? 'Carregant les cançons…'
                      : 'Calen almenys dues cançons per fer una ràdio',
            },
            style: {
                enabled: styleReady,
                styles: list,
                label: list.length ? `Ràdio de l’estil: ${list.join(', ')}` : 'Ràdio de l’estil',
                hint: styleReady
                    ? `Estil: ${list.join(' · ')}`
                    : loading
                      ? 'Carregant els estils…'
                      : 'Aquest artista encara no té cap estil assignat',
            },
        };
    }

    // Presentació: el text net (en conserva els salts de línia, però no més d'un de buit seguit).
    function bioModel(description) {
        const clean = text(description)
            .replace(/\r\n?/g, '\n')
            .replace(/\n{3,}/g, '\n\n');
        return { text: clean, hasText: clean.length > 0 };
    }

    // ---------- DOM ----------

    const state = { channelId: '', name: '', styles: [], songs: [], loading: false, program: false };
    let bound = false;

    const $ = id => window.document?.getElementById?.(id) || null;

    function toast(message) {
        const fn = app.features.shellNav?.toast;
        if (typeof fn === 'function') fn(message);
    }

    function renderRadios() {
        const wrap = $('apRadios');
        if (!wrap) return;
        wrap.hidden = state.program;
        const model = radiosModel({
            name: state.name,
            styles: state.styles,
            songCount: state.songs.length,
            loading: state.loading,
        });
        [
            ['apRadioArtist', model.artist],
            ['apRadioStyle', model.style],
        ].forEach(([id, item]) => {
            const button = $(id);
            if (!button) return;
            button.disabled = !item.enabled;
            button.title = item.hint;
            button.setAttribute('aria-label', item.label);
        });
    }

    // Tres línies de presentació; el botó només hi és si el text no hi cap.
    function measureBio() {
        const desc = $('channelProfileDescription');
        const toggle = $('apBioToggle');
        if (!desc || !toggle) return;
        if (desc.classList.contains('is-collapsed')) {
            toggle.hidden = !(desc.scrollHeight - desc.clientHeight > 1);
        }
    }

    function setBio(description) {
        const section = $('apBio');
        const desc = $('channelProfileDescription');
        const toggle = $('apBioToggle');
        if (!section || !desc || !toggle) return;
        const bio = bioModel(description);
        desc.textContent = bio.text;
        desc.classList.add('is-collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Llegeix-ne més';
        toggle.hidden = true;
        section.hidden = !bio.hasText;
        if (bio.hasText) window.requestAnimationFrame?.(measureBio);
    }

    function toggleBio() {
        const desc = $('channelProfileDescription');
        const toggle = $('apBioToggle');
        if (!desc || !toggle) return;
        const expanded = desc.classList.toggle('is-collapsed') === false;
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.textContent = expanded ? 'Mostra’n menys' : 'Llegeix-ne més';
        if (!expanded) measureBio();
    }

    // Obre la fitxa: presentació, estils i ràdios (encara sense cançons: s’habiliten amb setSongs()).
    function showProfile({ channelId = '', name = '', description = '', categories = [], program = false } = {}) {
        state.channelId = text(channelId);
        state.name = text(name);
        state.program = Boolean(program);
        state.songs = [];
        state.loading = true;
        const music = window.SegueixMusicCategories;
        state.styles = artistStyles({
            categories: [...(music?.categoriesForChannel?.(state.channelId) || []), ...categories],
            primary: music?.primaryCategoryForChannel?.(state.channelId) || '',
            labels: (music?.CATEGORY_GROUPS || []).map(group => group.label),
        });
        setBio(description);
        renderRadios();
        bindOnce();
    }

    // Cançons ja carregades del canal: habilita la ràdio de l'artista.
    function setSongs(videos, channelId = '') {
        if (channelId && text(channelId) !== state.channelId) return;
        state.songs = songsOf(videos);
        state.loading = false;
        renderRadios();
    }

    function startArtistRadio() {
        const started = app.features.musicQueue?.startArtistRadio?.(state.songs, {
            name: state.name,
            channelId: state.channelId,
        });
        if (!started) toast('No s’ha pogut engegar la ràdio ara mateix.');
        return Boolean(started);
    }

    function startStyleRadio() {
        const started = app.features.musicQueue?.startStyleRadio?.(state.styles);
        if (!started) toast('Aquest estil té massa poques cançons per fer una ràdio.');
        return Boolean(started);
    }

    function onClick(event) {
        const target = event.target;
        const radio = target?.closest?.('[data-ap-radio]');
        if (radio && !radio.disabled) {
            return radio.dataset.apRadio === 'style' ? startStyleRadio() : startArtistRadio();
        }
        if (target?.closest?.('#apBioToggle')) return toggleBio();
        return undefined;
    }

    function bindOnce() {
        if (bound) return;
        const page = $('channelPage');
        if (!page) return;
        bound = true;
        page.addEventListener('click', onClick);
        window.addEventListener('resize', measureBio, { passive: true });
    }

    app.features.artistPage = {
        artistStyles,
        songsOf,
        radiosModel,
        bioModel,
        showProfile,
        setSongs,
        startArtistRadio,
        startStyleRadio,
        measureBio,
    };
})(window);
