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
    // data: { type: 'playlist'|'radio'|'category'|'history', name: string, items: Array }
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

    app.utils.shareCodecs = {
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
