'use strict';

// Detecta les cançons que ofereixen subtítols en castellà/espanyol segons el que el mateix vídeo declara al títol o
// a la descripció («Subtítulos Español», «Subtítols disponibles en català/euskera/castellà», «SUB CAST DISPONIBLE»,
// «Subtitles in German and Spanish»…).
//
// No mira les pistes reals de subtítols de YouTube: l'API de dades només les dona al propietari (captions.list
// demana OAuth) i les pàgines de YouTube bloquegen els servidors (HTTP 429). Per això és un detector de DECLARACIONS:
// una fila de crèdits («Subtítols: Maria Puig») o una sala («CC Delicias») no compta; cal que al costat de la paraula
// «subtítols» hi hagi el castellà/espanyol.

// Paraula de subtítols (en català, castellà, anglès, alemany, francès, italià). `sub` sol només va en majúscules o
// seguit de punt/dos punts per no confondre'l amb prefixos.
const SUBTITOLS = String.raw`(?:subt[ií]t(?:ol|ul|le)s?|subt[ií]tulos?|subtitl(?:e|es|ed)|subtitulad[oa]s?|sous-titres?|sottotitoli|untertitel[n]?|\bsubs?\b[.:]?|\bcc\b\s*[:=])`;
// Castellà / espanyol, també abreujat quan va enganxat a «sub» («SUB CAST», «Subs ESP»)
const CASTELLA = String.raw`(?:espa[nñ]o?l(?:a|s|es)?|espanyol(?:s|a|es)?|castell[aà]|castellano|castilian|spanish|spanisch|espagnol|spagnolo)`;
const ABREUJAT = String.raw`(?:\bcast\b|\besp\b|\bspa\b)`;

// «subtítols … castellà» a la mateixa frase (sense salt de línia i com a molt 90 caràcters entremig)
const SUBTITOLS_I_CASTELLA = new RegExp(`${SUBTITOLS}[^\\n]{0,90}?${CASTELLA}`, 'i');
// «castellà … subtítols» («Spanish subtitles», «Castellà: subtítols»)
const CASTELLA_I_SUBTITOLS = new RegExp(`${CASTELLA}[^\\n]{0,25}?${SUBTITOLS}`, 'i');
// «SUB CAST», «Subs: ESP/ENG»: l'abreviatura ha d'anar just darrere de «sub»
const SUB_ABREUJAT = new RegExp(String.raw`\bsubs?\b[.:]?\s*(?:[:\-–/]\s*)?${ABREUJAT}`, 'i');

// Frases que semblen una declaració però diuen que NO n'hi ha («sense subtítols en castellà»)
const NEGACIO = /\b(?:sense|sin|without|no hi ha|no hay|no)\s+(?:els\s+|los\s+|les\s+|the\s+)?(?:[a-zàèéíòóúüç]{3,12}\s+)?(?:subt[ií]t|subtitl)/i;

function declaracio(video) {
    const text = `${video?.title || ''}\n${video?.description || ''}`;
    if (!text.trim()) return null;
    for (const regla of [SUBTITOLS_I_CASTELLA, CASTELLA_I_SUBTITOLS, SUB_ABREUJAT]) {
        const match = text.match(regla);
        if (!match) continue;
        const abans = text.slice(Math.max(0, match.index - 40), match.index + match[0].length);
        if (NEGACIO.test(abans)) continue;
        return match[0].replace(/\s+/g, ' ').trim();
    }
    return null;
}

// Només les cançons (un programa, una entrevista o un directe no són cançons del catàleg)
function teSubtitolsCastella(video) {
    return declaracio(video) !== null;
}

module.exports = { teSubtitolsCastella, declaracio };
