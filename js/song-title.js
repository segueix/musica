// Títols de cançó nets: sense el nom de l'artista i sense cap referència a «videoclip», «vídeo» o «oficial».
// L'artista ja surt a part a totes les targetes; els títols de YouTube venen carregats de «Artista - Cançó
// (Videoclip Oficial)». Funcions pures (UMD): es fan servir al navegador (window.SegueixSongTitle) i als tests.
//
// Què treu:
//  - Claudàtors, parèntesis i claus que esmenten videoclip/vídeo/oficial: (Videoclip Oficial), [Official Audio],
//    (Lyric Video), (Videolyric), (Àudio oficial), (oficial)…
//  - Un final «| Official Music Video», «- Videoclip oficial», «Videoclip oficial» (o el mateix al davant).
//  - El nom de l'artista a l'inici («Artista - Cançó», «Artista, Convidat & Altre - Cançó», «Artista: Cançó»)
//    o al final («Cançó - Artista», «Cançó - Artista (2026)»).
// Què NO treu: una paraula «video»/«oficial» enmig d'una frase, la resta de parèntesis (en directe, acústic,
// remix, any…), els convidats dins el títol («feat. X») ni el nom de l'artista si forma part de la cançó.
// El títol original es conserva a `video.originalTitle` (les marques del títol continuen servint per detectar
// videoclips oficials, versions en directe, etc.).
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.SegueixSongTitle = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    // Separadors de crèdit: guió, guió mitjà i llarg o punt volat, sempre amb espais.
    const DASH = /\s(?:[-–—]|·)\s/;
    const BRACKET_GROUP = /[([{][^()[\]{}]*[)\]}]/g;

    // Paraules «de soroll»: el que es demana treure. Es detecten sense accents ni majúscules.
    //  video, vídeo, videoclip, videolyric, lyricvideo, videomood… | oficial, oficials, official, officiel
    const NOISE = /^(?:\w*video\w*|oficial\w*|official\w*|officiel\w*)$/;
    // Paraules que poden acompanyar el soroll en un final sense claudàtors («Official Music Video»).
    const FILLER = new Set([
        'music',
        'musical',
        'musica',
        'lyric',
        'lyrics',
        'lirica',
        'audio',
        'single',
        'clip',
        'teaser',
        'visualizer',
        'visualiser',
        'mood',
        'pseudo',
        'hd',
        '4k',
        'nou',
        'nova',
        'new',
        'de',
        'del',
        'la',
        'el',
        'the',
        'by',
    ]);
    // Paraules que fan que un fragment sigui part del títol i no un crèdit: «Cançó - Manel Live» és una versió.
    const KEEP = new Set([
        'live',
        'directe',
        'directo',
        'viu',
        'concert',
        'acustic',
        'acustica',
        'acoustic',
        'unplugged',
        'version',
        'versio',
        'remix',
        'mix',
        'session',
        'sessio',
        'cover',
        'demo',
        'remaster',
        'instrumental',
    ]);
    // Connectors que poden unir artistes en un crèdit.
    const CONNECTORS = new Set(['i', 'y', 'and', 'et', 'e', 'amb', 'with', 'feat', 'ft', 'featuring', 'x', 'vs']);

    function fold(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/\p{M}+/gu, '')
            .toLowerCase();
    }

    // Paraules d'un text (sense accents, punts volats ni puntuació): «Al·lèrgiques» → «allergiques».
    function words(value) {
        return fold(value)
            .replace(/[··]/g, '')
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim()
            .split(' ')
            .filter(Boolean);
    }

    const isNoiseWord = word => NOISE.test(word);
    const hasNoise = text => words(text).some(isNoiseWord);

    // ---------- Soroll de videoclip / vídeo / oficial ----------

    function removeNoiseGroups(text) {
        let previous;
        let current = text;
        do {
            previous = current;
            current = current.replace(BRACKET_GROUP, group => (hasNoise(group) ? ' ' : group));
        } while (current !== previous);
        return current;
    }

    // Una successió de paraules és «soroll» si en conté alguna de soroll i la resta són d'acompanyament.
    function isNoisePhrase(list) {
        return list.length > 0 && list.some(isNoiseWord) && list.every(word => isNoiseWord(word) || FILLER.has(word));
    }

    // Separa un text en trossos de paraules amb la seva posició per poder tallar pel final o per l'inici.
    function trimTrailingNoise(text) {
        // Amb separador: «… | Official Music Video», «… - Videoclip Oficial»
        const tail = text.match(/^(.*\S)\s*[-–—|·:]\s*([^-–—|·:]*)$/);
        if (tail && isNoisePhrase(words(tail[2]))) return tail[1];
        // Sense separador: «… videoclip oficial» (fins a 4 paraules d'acompanyament al final)
        const parts = text.split(/\s+/);
        for (let size = Math.min(4, parts.length - 1); size >= 1; size--) {
            if (isNoisePhrase(words(parts.slice(-size).join(' ')))) return parts.slice(0, -size).join(' ');
        }
        return text;
    }

    function trimLeadingNoise(text) {
        const head = text.match(/^([^-–—|·:]*)\s*[-–—|·:]\s*(\S.*)$/);
        if (head && isNoisePhrase(words(head[1]))) return head[2];
        return text;
    }

    // Fragments entre «|», «·» o guió que són només soroll, en qualsevol posició: «A | VIDEOCLIP | EP B» → «A | EP B».
    function dropNoiseSegments(text) {
        const parts = text.split(/(\s[-–—]\s|\s*[|·]\s*)/);
        if (parts.length < 3) return text;
        let result = '';
        for (let i = 0; i < parts.length; i += 2) {
            if (isNoisePhrase(words(parts[i]))) continue;
            // El separador que hi havia abans del fragment només es conserva si ja hi ha text al davant
            result += (result ? parts[i - 1] : '') + parts[i];
        }
        return result;
    }

    function removeNoise(text) {
        let current = dropNoiseSegments(removeNoiseGroups(text));
        for (let i = 0; i < 3; i++) {
            const next = tidy(trimLeadingNoise(trimTrailingNoise(tidy(current))));
            if (next === tidy(current)) break;
            current = next;
        }
        return tidy(current);
    }

    // ---------- Nom de l'artista ----------

    // «alfredgarcia» i «Alfred García» són el mateix nom: es compara per paraules i pel text compactat.
    const preparedNameCache = new Map();
    function prepareNames(list) {
        const cacheKey = JSON.stringify(list);
        if (preparedNameCache.has(cacheKey)) return preparedNameCache.get(cacheKey);
        const seen = new Set();
        const prepared = [];
        (Array.isArray(list) ? list : [list]).forEach(value => {
            // «Artista - Topic» (canal automàtic de YouTube Music) i «ArtistaVEVO»
            const cleaned = String(value ?? '')
                .replace(/(?:\s*[-–—]\s*|\s+)(?:t[oò]pic|tema|oficial|official)\s*$/i, '')
                .replace(/vevo\s*$/i, '')
                .trim();
            const list2 = words(cleaned);
            const compact = list2.join('');
            if (compact.length < 2 || seen.has(compact)) return;
            seen.add(compact);
            prepared.push({ words: list2, compact });
        });
        if (preparedNameCache.size >= 2048) preparedNameCache.clear();
        preparedNameCache.set(cacheKey, prepared);
        return prepared;
    }

    // Posició (inici, final) on el nom apareix a la llista de paraules, o null.
    function findName(segmentWords, name) {
        const length = name.words.length;
        for (let i = 0; i + length <= segmentWords.length; i++) {
            if (name.words.every((word, index) => segmentWords[i + index] === word)) return [i, i + length];
        }
        // Nom escrit junt («alfredgarcia») o separat en el títol (o a l'inrevés)
        for (let i = 0; i < segmentWords.length; i++) {
            let joined = '';
            for (let j = i; j < Math.min(segmentWords.length, i + 4); j++) {
                joined += segmentWords[j];
                if (joined === name.compact) return [i, j + 1];
                if (joined.length > name.compact.length) break;
            }
        }
        return null;
    }

    function matchName(segment, names) {
        const segmentWords = words(segment);
        for (const name of names) {
            const span = findName(segmentWords, name);
            if (span) return { name, words: segmentWords, span };
        }
        return null;
    }

    // Paraules d'un fragment que no són de l'artista ni connectors (convidats, text addicional…).
    function extraWords(match) {
        const { words: all, span } = match;
        return all.filter((word, index) => (index < span[0] || index >= span[1]) && !CONNECTORS.has(word));
    }

    // Un crèdit és el nom (amb connectors i, com a molt, `limit` paraules més) sense marques de versió.
    const isCredit = (match, limit) => {
        const extra = extraWords(match);
        return extra.length <= limit && !extra.some(word => KEEP.has(word));
    };

    // Parèntesis/claudàtors del final d'un fragment («Artista (2026)»): es conserven en treure l'artista.
    function splitTrailingGroups(text) {
        const match = text.match(/^(.*?)((?:\s*[([{][^()[\]{}]*[)\]}])+)\s*$/);
        return match ? { core: match[1].trim(), groups: match[2].trim() } : { core: text.trim(), groups: '' };
    }

    function removeArtist(text, names) {
        if (!names.length) return text;

        // «Artista - Topic - Cançó» i «Cançó - Artista - Tema»: el marcador
        // pertany al crèdit del canal, mai a una cançó que es digui «Tema».
        const autoChannel = text.match(/^(.+?)\s[-–—]\s(?:t[oò]pic|tema)\s[-–—]\s(.+)$/i);
        if (autoChannel) {
            const match = matchName(autoChannel[1], names);
            if (match && isCredit(match, 0)) return autoChannel[2];
        }
        const channelTail = text.match(/^(.+)\s[-–—]\s(.+?)\s[-–—]\s(?:t[oò]pic|tema)$/i);
        if (channelTail) {
            const match = matchName(channelTail[2], names);
            if (match && isCredit(match, 0)) return channelTail[1];
        }

        // Crèdit a l'inici: «Artista - Cançó», «Artista, Convidat & Altre - Cançó»
        const dash = text.match(new RegExp(`^(.+?)${DASH.source}(.+)$`));
        if (dash && dash[2].trim()) {
            const match = matchName(dash[1], names);
            // Col·laboradors (fins a 6 paraules) però no text descriptiu amb xifres («… a la Fira 2017 - Cançó»;
            // només «Artista 1991 - Cançó», que és l'artista amb l'any) ni un fragment amb parèntesis
            // («La iaia (La Maria Rubio) - Lloc» és el títol, no un crèdit)
            if (match && !/[([{]/.test(dash[1]) && isCredit(match, 6)) {
                const extra = extraWords(match);
                if (!extra.some(word => /^\d+$/.test(word)) || extra.length === 1) return dash[2];
            }
        }

        // Artista seguit del títol entre cometes: «Artista "Cançó" (Featuring X)» → «Cançó (Featuring X)»
        const quoted = text.match(/^(.+?)\s*[“"«]([^“"«»”]+)[”"»]\s*((?:[([{][^()[\]{}]*[)\]}]\s*)*)$/);
        if (quoted && quoted[2].trim()) {
            const match = matchName(quoted[1], names);
            if (match && isCredit(match, 2)) return `${quoted[2].trim()} ${quoted[3]}`.trim();
        }

        // Crèdit curt a l'inici amb dos punts o barra: «Artista: Cançó», «Artista | Cançó» (només el nom, sense text)
        const soft = text.match(/^([^|:]+?)\s*[|:]\s+(\S.*)$/);
        if (soft && !DASH.test(soft[1]) && !/[([{]/.test(soft[1])) {
            const match = matchName(soft[1], names);
            if (match && isCredit(match, 4)) return soft[2];
        }

        // Crèdit al final: «Cançó - Artista» / «Cançó - Artista (2026)»
        const index = Math.max(...['-', '–', '—', '·'].map(char => text.lastIndexOf(` ${char} `)));
        if (index > 0) {
            const head = text.slice(0, index);
            const { core, groups } = splitTrailingGroups(text.slice(index + 3));
            const match = core && !/[|:]/.test(core) ? matchName(core, names) : null;
            // Només és un crèdit si no hi ha gaire res més que el nom (un «dirigit per X» no és el títol)
            const limit =
                match && match.words.some(word => word === 'feat' || word === 'ft' || word === 'featuring') ? 3 : 1;
            if (match && head.trim() && isCredit(match, limit)) return `${head.trim()} ${groups}`.trim();
        }
        return text;
    }

    // ---------- Neteja final ----------

    function tidy(text) {
        return String(text ?? '')
            .replace(/[()[\]{}]\s*[()[\]{}]/g, match =>
                /^[([{]\s*[)\]}]$/.test(match.replace(/\s/g, '')) ? ' ' : match
            )
            .replace(/\s*[([{]\s*$/, '')
            .replace(/^\s*[)\]}]\s*/, '')
            .replace(/\s+/g, ' ')
            .replace(/^[\s\-–—|·:,;]+|[\s\-–—|·:,;]+$/g, '')
            .trim();
    }

    const hasContent = text => /[\p{L}\p{N}]/u.test(text);

    // Títol net. `options.artists`: noms de l'artista (canal, noms de la base d'artistes, àlies).
    function cleanTitle(title, options = {}) {
        const original = String(title ?? '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!original) return String(title ?? '');
        const withoutNoise = removeNoise(original);
        if (!hasContent(withoutNoise)) return original;
        const names = prepareNames(options.artists || []);
        const withoutArtist = tidy(removeNoise(removeArtist(withoutNoise, names)));
        return hasContent(withoutArtist) ? withoutArtist : withoutNoise;
    }

    // Còpia del vídeo amb el títol net i el de YouTube a `originalTitle` (el mateix objecte si no canvia res).
    function cleanVideo(video, extraNames = []) {
        if (!video || typeof video.title !== 'string' || !video.title) return video;
        const raw = typeof video.originalTitle === 'string' && video.originalTitle ? video.originalTitle : video.title;
        const artists = [
            video.channelTitle,
            video.snippet?.channelTitle,
            ...(Array.isArray(extraNames) ? extraNames : []),
        ];
        const cleaned = cleanTitle(raw, { artists });
        if (cleaned === video.title && video.originalTitle === raw) return video;
        if (cleaned === raw && !video.originalTitle) return video;
        return { ...video, title: cleaned, originalTitle: raw };
    }

    return { cleanTitle, cleanVideo, hasNoise, words };
});

