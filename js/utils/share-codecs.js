// ==================== SHARE CODECS ====================
// Canal A — Compartició ràpida per URL comprimida + QR
// NOTA: Aquest mòdul és EXCLUSIVAMENT per a compartició ràpida via URL (?importData=).
//       L'exportació/importació manual JSON massiva (Canal B) és un canal completament separat.
//
// Depèn de: LZString (lz-string via CDN, carregat abans d'aquest script)

(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.utils = app.utils || {};

    // Els enllaços de compartició obren Segueix Música, no la web de Segueix youtubers.
    // De moment, allotjat a GitHub Pages; si canvia el domini, només cal tocar aquesta constant.
    const SHARE_BASE_URL = 'https://segueix.github.io/musica/';
    const PAYLOAD_VERSION = 1;
    const MAX_SHARE_START_SECONDS = 24 * 60 * 60;

    // Construeix l'URL públic d'una compartició (vídeo, canal, categoria...).
    // IMPORTANT: no s'hi pot afegir cap paràmetre de "cache busting". El paràmetre `t`
    // està reservat al segon d'inici de reproducció (?v=ID&t=SEGONS): quan s'hi posava
    // un Date.now() en mil·lisegons, qui obria l'enllaç rebia un `start` de milers de
    // milions de segons i el reproductor de YouTube no arrencava el vídeo.
    function buildAppShareUrl(query, hash) {
        const rawQuery = query || '';
        const normalizedQuery = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
        const queryString = new URLSearchParams(normalizedQuery).toString();
        const rawHash = hash || '';
        const normalizedHash = rawHash ? (rawHash.startsWith('#') ? rawHash : `#${rawHash}`) : '';
        return `${SHARE_BASE_URL}${queryString ? `?${queryString}` : ''}${normalizedHash}`;
    }

    // Pàgines HTML pròpies: els robots socials no executen el JavaScript de l'app.
    function buildEntityShareUrl(kind, id) {
        if (!['canco', 'artista'].includes(kind) || !/^[A-Za-z0-9_-]+$/.test(String(id || ''))) {
            return SHARE_BASE_URL;
        }
        return `${SHARE_BASE_URL}compartir/${kind}/${id}.html`;
    }

    // Llegeix el paràmetre `t` (segon d'inici de reproducció). Els enllaços generats
    // abans del juliol de 2026 hi portaven un Date.now() en mil·lisegons com a cache
    // buster; aquests valors s'ignoren perquè no són un segon d'inici vàlid.
    function parseShareStartSeconds(rawValue) {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return 0;
        }
        const seconds = Math.floor(parsed);
        return seconds > MAX_SHARE_START_SECONDS ? 0 : seconds;
    }

    // Construeix el payload mínim per a compartició ràpida
    // data: { type: 'playlist'|'radio'|'category'|'history'|'nearby', name: string, items: Array }
    //       («radio» i «playlist» porten ID de vídeos; la ràdio es reprodueix tal com va, la llista es desa)
    function buildImportPayload(data) {
        const sourceItems = Array.isArray(data.items) ? data.items : [];
        const normalizedItems =
            data.type === 'category'
                ? sourceItems
                      .map(function (item) {
                          if (item == null) return null;
                          if (typeof item === 'string' || typeof item === 'number') return item;
                          if (typeof item === 'object') return item.channelId || item.id || null;
                          return null;
                      })
                      .filter(Boolean)
                : sourceItems;

        // «A prop teu»: no porta cançons sinó la localitat triada per l'usuari (mai coordenades GPS) i el tipus de
        // ràdio. Qui obre l'enllaç calcula els 20 artistes més propers amb el seu catàleg.
        if (data.type === 'nearby') {
            const place = data.place || {};
            const round = n => Math.round(Number(n) * 1000) / 1000;
            return {
                v: PAYLOAD_VERSION,
                type: 'nearby',
                name: data.name || place.name || '',
                place: {
                    n: String(place.name || ''),
                    t: String(place.territory || ''),
                    lat: round(place.coordinates?.latitude),
                    lon: round(place.coordinates?.longitude),
                },
                kind: data.kind || '',
            };
        }

        return {
            v: PAYLOAD_VERSION,
            type: data.type,
            name: data.name || '',
            items: normalizedItems,
        };
    }

    // Serialitza i comprimeix el payload per incrustar-lo a la URL
    function encodeImportPayload(payload) {
        try {
            if (typeof LZString === 'undefined') {
                console.error('[share-codecs] LZString no disponible (CDN bloquejat?)');
                return null;
            }
            const json = JSON.stringify(payload);
            return LZString.compressToEncodedURIComponent(json);
        } catch (e) {
            console.error('[share-codecs] Error codificant payload:', e);
            return null;
        }
    }

    // Descomprimeix i parseja el valor del paràmetre importData
    function decodeImportPayload(value) {
        try {
            if (typeof LZString === 'undefined') {
                console.error('[share-codecs] LZString no disponible (CDN bloquejat?)');
                return null;
            }
            const json = LZString.decompressFromEncodedURIComponent(value);
            if (!json) return null;
            return JSON.parse(json);
        } catch (e) {
            console.error('[share-codecs] Error decodificant payload:', e);
            return null;
        }
    }

    // Genera la URL completa amb el payload comprimit
    function buildImportUrl(payload) {
        const encoded = encodeImportPayload(payload);
        if (!encoded) return null;
        return `${SHARE_BASE_URL}?importData=${encoded}`;
    }

    // ---------- Ràdios: títol i pàgina de previsualització ----------
    // WhatsApp i les altres xarxes no executen JavaScript: el títol de la previsualització surt de l'HTML estàtic.
    // Per a cada ràdio amb nom conegut (estils, municipis, artistes) hi ha una pàgina compartir/radio/<slug>.html
    // amb «Ràdio <nom>» (scripts/generar_pagines_compartir.js) que redirigeix a l'app amb el mateix ?importData=.
    function radioShareTitle(name) {
        const clean = String(name || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!clean) return 'Ràdio';
        const near = clean.match(/^a prop de (.+?)(?: · .+)?$/i);
        if (near) return `Ràdio ${near[1].trim()}`;
        if (/^(r[àa]dio\b|la teva r[àa]dio$)/i.test(clean)) return clean;
        return `Ràdio ${clean}`;
    }

    function radioShareSlug(title) {
        return String(title || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/l·l/g, 'll')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 90)
            .replace(/-+$/g, '');
    }

    // URL de la pàgina de la ràdio (o la genèrica si no n'hi ha) amb el mateix paràmetre que l'enllaç de l'app.
    function buildRadioPageUrl(slug, importUrl) {
        const query = String(importUrl || '').split('?')[1] || '';
        const page = slug ? `${slug}.html` : 'index.html';
        return `${SHARE_BASE_URL}compartir/radio/${page}${query ? `?${query}` : ''}`;
    }

    let radioPagesPromise = null;
    function loadRadioPages() {
        if (!radioPagesPromise) {
            radioPagesPromise = fetch('compartir/radio/index.json', { cache: 'no-cache' })
                .then(response => (response.ok ? response.json() : []))
                .then(list => new Set(Array.isArray(list) ? list : list?.slugs || []))
                .catch(() => {
                    radioPagesPromise = null;
                    return new Set();
                });
        }
        return radioPagesPromise;
    }

    // { title, url, hasPage }: url és la pàgina amb «Ràdio <nom>» si existeix; si no, la genèrica.
    async function resolveRadioShare(name, importUrl) {
        const title = radioShareTitle(name);
        const slug = radioShareSlug(title);
        const pages = await loadRadioPages();
        const hasPage = Boolean(slug && pages.has(slug));
        return { title, url: buildRadioPageUrl(hasPage ? slug : '', importUrl), hasPage };
    }

    app.utils.shareCodecs = {
        radioShareTitle,
        radioShareSlug,
        buildRadioPageUrl,
        resolveRadioShare,
        buildImportPayload,
        encodeImportPayload,
        decodeImportPayload,
        buildImportUrl,
        buildAppShareUrl,
        buildEntityShareUrl,
        parseShareStartSeconds,
        SHARE_BASE_URL,
        MAX_SHARE_START_SECONDS,
    };
})(window);
