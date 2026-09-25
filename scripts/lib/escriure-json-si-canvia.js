// Helper compartit: escriu un fitxer JSON NOMÉS si el contingut significatiu ha
// canviat, ignorant claus de timestamp (p. ex. "generatedAt"). Serveix per evitar
// que el pipeline reescrigui centenars de fitxers d'arxiu/índex a cada execució
// quan l'únic canvi és la marca de temps — soroll que inflava l'històric de git.

const fs = require('fs');
const fsp = require('fs/promises');

// Claus que no compten com a canvi real (només marquen quan es va generar).
const DEFAULT_IGNORE_KEYS = ['generatedAt'];

function serialize(value, { indent = 2, trailingNewline = false } = {}) {
    return JSON.stringify(value, null, indent) + (trailingNewline ? '\n' : '');
}

// Elimina recursivament les claus ignorades perquè la comparació només miri el
// contingut significatiu. Retorna una còpia neta (no muta l'entrada).
function stripKeys(node, ignoreKeys) {
    if (Array.isArray(node)) {
        return node.map((item) => stripKeys(item, ignoreKeys));
    }
    if (node && typeof node === 'object') {
        const out = {};
        for (const key of Object.keys(node)) {
            if (ignoreKeys.includes(key)) continue;
            out[key] = stripKeys(node[key], ignoreKeys);
        }
        return out;
    }
    return node;
}

// Compara el contingut ja serialitzat amb el que hi ha al disc. Si no hi ha claus
// a ignorar, fa una comparació byte a byte (exactament el que veu git). Si n'hi ha,
// parseja tots dos i compara ignorant-les.
function meaningfulContentEquals(existingRaw, serialized, ignoreKeys) {
    if (existingRaw === null || existingRaw === undefined) return false;
    if (!ignoreKeys.length) return existingRaw === serialized;
    try {
        const a = JSON.stringify(stripKeys(JSON.parse(existingRaw), ignoreKeys));
        const b = JSON.stringify(stripKeys(JSON.parse(serialized), ignoreKeys));
        return a === b;
    } catch (_) {
        // Si algun no parseja (fitxer corromput, format diferent), tracta'l com a
        // diferent perquè s'escrigui i quedi consistent.
        return false;
    }
}

// Versió síncrona. Retorna true si ha escrit, false si l'ha omès per ser idèntic.
function writeJsonIfChanged(filePath, value, options = {}) {
    const { ignoreKeys = DEFAULT_IGNORE_KEYS, indent = 2, trailingNewline = false } = options;
    const serialized = serialize(value, { indent, trailingNewline });
    let existingRaw = null;
    try {
        existingRaw = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
        existingRaw = null; // No existeix → cal escriure'l.
    }
    if (meaningfulContentEquals(existingRaw, serialized, ignoreKeys)) {
        return false;
    }
    fs.writeFileSync(filePath, serialized);
    return true;
}

// Versió asíncrona (fs/promises), per als scripts que ja treballen amb await.
async function writeJsonIfChangedAsync(filePath, value, options = {}) {
    const { ignoreKeys = DEFAULT_IGNORE_KEYS, indent = 2, trailingNewline = false } = options;
    const serialized = serialize(value, { indent, trailingNewline });
    let existingRaw = null;
    try {
        existingRaw = await fsp.readFile(filePath, 'utf8');
    } catch (_) {
        existingRaw = null;
    }
    if (meaningfulContentEquals(existingRaw, serialized, ignoreKeys)) {
        return false;
    }
    await fsp.writeFile(filePath, serialized);
    return true;
}

module.exports = {
    writeJsonIfChanged,
    writeJsonIfChangedAsync,
    stripKeys,
    meaningfulContentEquals,
    DEFAULT_IGNORE_KEYS,
};
