'use strict';

// Gestió local dels lots. La lectura de fonts i el judici lingüístic els fa l'agent de la sessió.
// No hi ha clients de xarxa, claus, models incrustats ni detecció automàtica de la llengua.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const POLICY = 'catala-una-estrofa-v3';
const QUEUE = 'data/revisio-idiomes.json';
const HIDDEN = 'data/hidden-videos.json';
const DIR = 'docs/revisions/idiomes-codex';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const norm = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const copy = value => JSON.parse(JSON.stringify(value));
const idOK = id => typeof id === 'string' && /^[\w-]{11}$/.test(id);
const identity = e => ({ id: e.id, artista: e.artista, artistaId: e.artistaId || '', canalId: e.canalId, titol: e.titol, tipus: e.tipus || 'song' });
const fingerprint = e => hash(identity(e));
const pack = value => JSON.stringify(value, null, 2) + '\n';
// Mateix format compacte del registre actual; es conserven també camps desconeguts.
const serializeQueue = value => '{\n' + Object.entries(value).map(([k, v]) =>
    `  ${JSON.stringify(k)}: ` + (Array.isArray(v) ? '[' + (v.length ? '\n' + v.map(x => '    ' + JSON.stringify(x)).join(',\n') + '\n  ' : '') + ']' : JSON.stringify(v))
).join(',\n') + '\n}\n';

function read(root, file, fallback) {
    const p = path.join(root, file);
    if (!fs.existsSync(p) && fallback !== undefined) return copy(fallback);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function load(root) {
    const state = read(root, QUEUE);
    const hidden = read(root, HIDDEN);
    for (const key of ['pendents', 'revisades', 'decisions']) assert(Array.isArray(state[key]), `Registre invàlid: ${key}`);
    assert(Array.isArray(hidden.videoIds), 'Registre d’ocults invàlid');
    const ids = state.pendents.map(e => e.id);
    assert(ids.every(idOK) && new Set(ids).size === ids.length, 'IDs pendents invàlids o duplicats');
    return { state, hidden };
}
function batchPath(id) {
    assert(/^lot-\d{4,}$/.test(id || ''), 'Identificador de lot invàlid');
    return `${DIR}/${id}.json`;
}
function batches(root) {
    if (!fs.existsSync(path.join(root, DIR))) return [];
    return fs.readdirSync(path.join(root, DIR)).filter(f => /^lot-\d{4,}\.json$/.test(f)).sort().map(f => {
        const b = read(root, `${DIR}/${f}`);
        assert(b.schemaVersion === 1 && Array.isArray(b.items) && Array.isArray(b.decisions) && b.applied, 'Lot invàlid: ' + f);
        assert(f === b.id + '.json', 'Nom i ID del lot no coincideixen');
        return b;
    });
}
function cell(value) { return String(value || '').replace(/[|\r\n<>]/g, ' ').slice(0, 350); }
function markdown(b) {
    return `# ${b.id} — revisió des de ChatGPT/Codex\n\nEstat: **${b.status}**. Política: ${b.policy}.\n\n` +
        'Les fonts es llegeixen a la sessió; aquest fitxer no certifica la llengua de cap cançó.\n\n' +
        '| ID | Artista | Títol | Resultat aplicat |\n|---|---|---|---|\n' +
        b.items.map(e => `| ${e.id} | ${cell(e.artista)} | ${cell(e.titol)} | ${b.applied[e.id]?.accio || 'per revisar'} |`).join('\n') +
        '\n\nEditar `decisions` al JSON. Validar amb `node scripts/revisar_idiomes_codex.cjs aplica --lot=' + b.id + ' --dry-run`.\n';
}
// Exclusió mútua local. No substitueix el control de conflictes Git entre branques.
function locked(root, fn) {
    const cache = path.join(root, '.cache'); fs.mkdirSync(cache, { recursive: true });
    const lock = path.join(cache, 'idiomes-codex.lock');
    let fd;
    try { fd = fs.openSync(lock, 'wx'); } catch { throw new Error('Una altra operació té el bloqueig. Comprova que no hi hagi cap procés actiu abans de retirar .cache/idiomes-codex.lock.'); }
    try { return fn(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function writeFiles(root, changes) {
    const journal = path.join(root, '.cache/idiomes-codex-transaction.json');
    assert(!fs.existsSync(journal), 'Transacció interrompuda: executa recupera abans de continuar.');
    const entries = Object.entries(changes).map(([file, after]) => ({ file, before: fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null, after }));
    fs.writeFileSync(journal, pack(entries));
    for (const e of entries) {
        const dest = path.join(root, e.file); fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest + '.idiomes-tmp', e.after); fs.renameSync(dest + '.idiomes-tmp', dest);
    }
    fs.unlinkSync(journal);
}
function recover(root) {
    const journal = path.join(root, '.cache/idiomes-codex-transaction.json');
    assert(fs.existsSync(journal), 'No hi ha transacció a recuperar.');
    const entries = JSON.parse(fs.readFileSync(journal, 'utf8'));
    for (const e of entries) {
        assert(e.file === QUEUE || e.file === HIDDEN || new RegExp('^' + DIR + '/lot-\\d{4,}\\.(json|md)$').test(e.file), 'Ruta de recuperació invàlida');
        const current = fs.existsSync(path.join(root, e.file)) ? fs.readFileSync(path.join(root, e.file), 'utf8') : null;
        assert(current === e.before || current === e.after, 'Hi ha canvis posteriors: recuperació manual necessària.');
    }
    for (const e of entries) {
        const dest = path.join(root, e.file);
        if (e.before === null) fs.rmSync(dest, { force: true }); else fs.writeFileSync(dest, e.before);
        fs.rmSync(dest + '.idiomes-tmp', { force: true });
    }
    fs.unlinkSync(journal);
    return { recuperada: true };
}
function progress(root, state) {
    const all = batches(root), attempts = new Map(), reserved = new Set();
    for (const b of all) for (const e of b.items) {
        const done = b.applied[e.id];
        if (done) attempts.set(e.id, { fingerprint: e.fingerprint, ...done });
        else if (b.status === 'obert') reserved.add(e.id);
    }
    return { all, attempts, reserved, state };
}
function status(root) {
    const { state } = load(root); const p = progress(root, state);
    const deferred = state.pendents.filter(e => p.attempts.get(e.id)?.accio === 'pendent' && p.attempts.get(e.id)?.fingerprint === fingerprint(e));
    return { pendents: state.pendents.length, examinadesSenseProves: deferred.length,
        perExaminar: state.pendents.length - deferred.length,
        lotsOberts: p.all.filter(b => b.status === 'obert').map(b => ({ lot: b.id, faltaExaminar: b.items.filter(e => !b.applied[e.id]).length })),
        politica: POLICY };
}
function prepare(root, { limit = 50, artist = '', retry = false, now = new Date().toISOString() } = {}) {
    assert(Number.isInteger(limit) && limit >= 1 && limit <= 100, 'Límit: enter entre 1 i 100');
    const { state } = load(root); const p = progress(root, state);
    const match = e => !artist || norm(e.artista).includes(norm(artist));
    const existing = p.all.find(b => b.status === 'obert' && b.items.some(e => !b.applied[e.id] && match(e)));
    if (existing) return { repren: existing.id, fitxer: batchPath(existing.id), pendents: state.pendents.length };
    const eligible = state.pendents.filter(e => {
        const old = p.attempts.get(e.id);
        return match(e) && !p.reserved.has(e.id) && (retry || !old || old.accio !== 'pendent' || old.fingerprint !== fingerprint(e));
    });
    const groups = new Map();
    for (const e of eligible) {
        const key = e.artistaId || e.canalId || e.artista;
        if (!groups.has(key)) groups.set(key, []); groups.get(key).push(e);
    }
    const selected = [];
    while (selected.length < limit) {
        let added = false;
        for (const g of groups.values()) if (g.length && selected.length < limit) { selected.push(g.shift()); added = true; }
        if (!added) break;
    }
    if (!selected.length) return { preparades: 0, ...status(root), nota: 'Cap entrada nova amb aquests filtres. Els dubtes no s’han aprovat; --reintenta permet revisar-los amb proves noves.' };
    const number = Math.max(0, ...p.all.map(b => Number(b.id.slice(4)))) + 1;
    const id = 'lot-' + String(number).padStart(4, '0');
    const b = { schemaVersion: 1, id, status: 'obert', policy: POLICY, preparedAt: now, sourceUpdatedAt: state.updatedAt,
        items: selected.map(e => ({ ...copy(e), fingerprint: fingerprint(e), url: 'https://www.youtube.com/watch?v=' + e.id })), decisions: [], applied: {} };
    writeFiles(root, { [batchPath(id)]: pack(b), [`${DIR}/${id}.md`]: markdown(b) });
    return { preparades: selected.length, artistes: new Set(selected.map(e => e.artista)).size, lot: id, fitxer: batchPath(id), pendents: state.pendents.length };
}
function sourceOK(s, now, resolved = true) {
    assert(s && typeof s === 'object', 'Font invàlida');
    assert(Object.keys(s).every(k => ['url', 'consultada', 'llegida', 'coincidenciaVersio'].includes(k)), 'La font només admet URL, data i comprovacions; no lletres');
    assert(typeof s.url === 'string' && s.url.length <= 2048, 'URL invàlida');
    let u; try { u = new URL(s.url); } catch { throw new Error('URL de font invàlida'); }
    assert(u.protocol === 'https:' && !u.username && !u.password && !/^(localhost|127\.|\[|10\.|192\.168\.)/i.test(u.hostname), 'Font HTTPS pública sense credencials requerida');
    assert(![...u.searchParams.keys()].some(k => /token|secret|key|signature|^sig$/i.test(k)), 'La font conté possibles credencials');
    if (resolved) assert(s.llegida === true && s.coincidenciaVersio === true, 'Cal llegir la font i comprovar la versió');
    const date = Date.parse(s.consultada);
    assert(Number.isFinite(date) && date <= Date.parse(now) + 60000, 'Data de consulta invàlida o futura');
}
function validate(d, item, state, now) {
    assert(d && idOK(d.id) && d.id === item.id, 'ID de decisió fora del lot');
    const allowed = ['id', 'accio', 'metode', 'llengues', 'motiu', 'fonts', 'lletraCompletaLlegida', 'fragmentCantatComprovat', 'instrumentalComprovat', 'edicio', 'correspondencia', 'decisioOrigen', 'titolCatala', 'mescla'];
    assert(Object.keys(d).every(k => allowed.includes(k)), 'Camp de decisió desconegut; no hi adjuntis lletres');
    assert(['conserva', 'amaga', 'pendent'].includes(d.accio), 'Acció invàlida');
    assert(typeof d.motiu === 'string' && d.motiu.trim().length >= 12 && d.motiu.length <= 600, 'Cal un motiu entre 12 i 600 caràcters');
    assert(Array.isArray(d.fonts) && d.fonts.length <= 8, 'Cal una llista de fonts (màxim 8)');
    if (d.accio === 'pendent') {
        assert(Object.keys(d).every(k => ['id', 'accio', 'motiu', 'fonts', 'metode'].includes(k)), 'Un pendent no porta afirmacions de validació');
        assert(!d.metode || d.metode === 'sense-proves', 'Un pendent no és una validació');
        d.fonts.forEach(s => sourceOK(s, now, false)); return;
    }
    assert(d.fonts.length > 0, 'Cap decisió resolutiva sense fonts');
    d.fonts.forEach(s => sourceOK(s, now));
    if (d.metode === 'titol-catala') {
        assert(d.accio === 'conserva' && typeof d.titolCatala === 'string' && d.titolCatala === item.titol, 'Cal identificar el títol català inequívoc de la mateixa entrada');
        assert(Array.isArray(d.llengues) && d.llengues.length === 0 && d.lletraCompletaLlegida !== true && d.fragmentCantatComprovat !== true, 'El títol no certifica llengües cantades ni lectura de lletra');
        assert(d.mescla === undefined && !state.decisions.some(x => x.id === d.id && x.llengues?.some(l => !['ca', 'oc', 'zxx'].includes(l))), 'El títol no pot esquivar una altra llengua documentada; cal revisar la mescla');
        return;
    }
    assert(d.titolCatala === undefined, 'titolCatala només correspon al mètode titol-catala');
    assert(Array.isArray(d.llengues) && d.llengues.length && d.llengues.every(l => /^[a-z]{2,3}$/.test(l) && l !== 'und'), 'Llengües identificades requerides');
    assert(new Set(d.llengues).size === d.llengues.length, 'Llengües duplicades');
    const hasCatalan = d.llengues.some(l => l === 'ca' || l === 'oc');
    const mixed = hasCatalan && d.llengues.some(l => !['ca', 'oc'].includes(l));
    assert(!d.llengues.includes('zxx') || d.llengues.length === 1, 'Instrumental no pot combinar-se amb llengües cantades');
    if (mixed) {
        const m = d.mescla;
        const fields = ['llenguaPrincipal', 'estrofesAltresLlengues', 'tornadaAltresLlengues', 'restaEnLlenguaPrincipal', 'estructuraCompletaVerificada'];
        assert(m && typeof m === 'object' && Object.keys(m).length === fields.length && Object.keys(m).every(k => fields.includes(k)), 'Cal documentar l’estructura de la mescla, no només les llengües');
        assert(d.llengues.includes(m.llenguaPrincipal) && Number.isInteger(m.estrofesAltresLlengues) && m.estrofesAltresLlengues >= 0 && typeof m.tornadaAltresLlengues === 'boolean' && typeof m.restaEnLlenguaPrincipal === 'boolean' && m.estructuraCompletaVerificada === true, 'Estructura lingüística incompleta o invàlida');
        assert(m.estrofesAltresLlengues > 0 || m.tornadaAltresLlengues || !m.restaEnLlenguaPrincipal, 'Estructura inconsistent: la mescla documentada ha de localitzar la llengua estrangera');
        assert(['lletra-completa', 'mateix-enregistrament'].includes(d.metode), 'Cal lletra íntegra o el mateix enregistrament verificat per comptar estrofes');
        const admitted = ['ca', 'oc'].includes(m.llenguaPrincipal) && m.estrofesAltresLlengues <= 1 && !m.tornadaAltresLlengues && m.restaEnLlenguaPrincipal;
        assert(d.accio === (admitted ? 'conserva' : 'amaga'), admitted ? 'La mescla compleix l’excepció de com a màxim una estrofa' : 'La mescla supera l’excepció de com a màxim una estrofa');
    } else {
        assert(d.mescla === undefined, 'mescla només correspon a cançons amb català/occità i altres llengües');
        if (d.accio === 'conserva') assert(hasCatalan || d.llengues[0] === 'zxx', 'Cal català/occità o instrumental');
        if (d.accio === 'amaga') assert(!hasCatalan && !d.llengues.includes('zxx'), 'No es pot excloure català/occità o instrumental per llengua');
    }
    if (d.metode === 'lletra-completa') assert(d.lletraCompletaLlegida === true && !d.llengues.includes('zxx'), 'Cal haver llegit la lletra íntegra');
    else if (d.metode === 'fragment-catala') throw new Error('Un fragment català no acredita el límit d’una estrofa; cal revisar la peça completa');
    else if (d.metode === 'instrumental-documentat') assert(d.accio === 'conserva' && d.instrumentalComprovat === true && d.llengues.length === 1 && d.llengues[0] === 'zxx', 'Absència de lletra no prova instrumentalitat');
    else if (d.metode === 'disc-documentat') assert(d.edicio && typeof d.edicio === 'string' && d.edicio.length >= 12 && d.edicio.length <= 300 && !d.llengues.includes('zxx'), 'Cal identificar l’edició i la seva llengua documentada');
    else if (d.metode === 'mateix-enregistrament') {
        const previous = state.decisions.find(x => x.id === d.decisioOrigen);
        assert(previous && previous.politica === POLICY && previous.accio === d.accio && previous.criteri !== 'confianca-artista', 'La decisió origen ha de complir la mateixa política vigent');
        assert(JSON.stringify(previous.llengues) === JSON.stringify(d.llengues), 'La llengua no coincideix amb la decisió origen');
        if (mixed) assert(JSON.stringify(previous.mescla) === JSON.stringify(d.mescla), 'L’estructura de la mescla no coincideix amb la decisió origen');
        assert(typeof d.correspondencia === 'string' && d.correspondencia.length >= 20 && d.correspondencia.length <= 400, 'Cal documentar el mateix enregistrament, no només el títol');
    } else throw new Error('Mètode no admès; biografia, cerca i confiança no validen una lletra');
    if (d.metode !== 'lletra-completa') assert(d.lletraCompletaLlegida !== true, 'No presentis una validació documental com a lectura de lletra íntegra');
}
function apply(root, id, { dryRun = false, now = new Date().toISOString() } = {}) {
    const { state, hidden } = load(root);
    const b = read(root, batchPath(id));
    assert(b.id === id && b.policy === POLICY && b.schemaVersion === 1 && ['obert', 'tancat'].includes(b.status), 'Lot invàlid, arxivat o desfet');
    assert(Array.isArray(b.items) && Array.isArray(b.decisions) && b.applied, 'Estructura de lot invàlida');
    assert(new Set(b.items.map(e => e.id)).size === b.items.length, 'Entrades del lot duplicades');
    assert(new Set(b.decisions.map(d => d.id)).size === b.decisions.length, 'Decisions duplicades');
    const pending = new Map(state.pendents.map(e => [e.id, e]));
    const itemMap = new Map(b.items.map(e => [e.id, e]));
    const policies = read(root, 'data/music-channel-video-allowlist.json', { channels: {} });
    const result = { lot: id, abans: state.pendents.length, conservades: 0, amagades: 0, dubtes: 0, omesesJaAplicades: 0, dryRun, noImplicaAltaAlFeed: true };
    const changes = [];
    for (const d of b.decisions) {
        const item = itemMap.get(d.id); assert(item, 'ID de decisió fora del lot');
        assert(item.fingerprint === fingerprint(item), 'La identitat del lot ha estat alterada');
        const done = b.applied[d.id];
        if (done) { assert(done.hash === hash(d), 'No modifiquis una decisió aplicada: desfés el lot o fes una revisió explícita'); result.omesesJaAplicades++; continue; }
        const current = pending.get(d.id);
        assert(current && fingerprint(current) === item.fingerprint, 'La cua ha canviat per a ' + d.id + ': reconcilia abans d’aplicar');
        assert(!state.decisions.some(x => x.id === d.id) && !state.revisades.includes(d.id), 'Ja hi ha una decisió manual per a ' + d.id);
        validate(d, item, state, now);
        if (d.accio === 'conserva') assert(!hidden.videoIds.includes(d.id) && policies.channels?.[item.canalId]?.blocked !== true, 'No es pot recuperar un vídeo/canal ocult o bloquejat des d’aquesta revisió');
        changes.push({ d, item, entryBefore: copy(current) });
    }
    for (const { d, item, entryBefore } of changes) {
        let record = null;
        const addedHidden = d.accio === 'amaga' && !hidden.videoIds.includes(d.id);
        if (d.accio !== 'pendent') {
            record = { id: d.id, accio: d.accio, artista: item.artista, titol: item.titol, font: d.fonts[0].url, fonts: d.fonts.map(s => s.url),
                data: now, origen: batchPath(id), criteri: 'revisio-codex-documentada', metode: d.metode, politica: POLICY,
                llengues: d.llengues, ...(d.mescla ? { mescla: copy(d.mescla) } : {}), ...(d.metode === 'titol-catala' ? { titolCatala: d.titolCatala } : {}), lletraIntegraVerificada: d.metode === 'lletra-completa',
                motiu: d.motiu, reutilitza: false };
            state.decisions.push(record); state.revisades.push(d.id);
            if (addedHidden) hidden.videoIds.push(d.id);
            pending.delete(d.id);
        }
        if (d.accio === 'conserva') result.conservades++;
        else if (d.accio === 'amaga') result.amagades++;
        else result.dubtes++;
        b.applied[d.id] = { accio: d.accio, hash: hash(d), recordHash: record ? hash(record) : null, hiddenAdded: addedHidden, entryBefore, data: now };
    }
    state.pendents = state.pendents.filter(e => pending.has(e.id));
    result.despres = state.pendents.length;
    result.senseExaminarAlLot = b.items.filter(e => !b.applied[e.id]).length;
    b.status = result.senseExaminarAlLot ? 'obert' : 'tancat';
    if (!dryRun && changes.length) {
        const files = { [batchPath(id)]: pack(b), [`${DIR}/${id}.md`]: markdown(b) };
        if (result.conservades || result.amagades) { state.updatedAt = now; state.revisades.sort(); files[QUEUE] = serializeQueue(state); files[HIDDEN] = pack(hidden); }
        writeFiles(root, files);
    }
    return result;
}
function undo(root, id, { dryRun = false, now = new Date().toISOString() } = {}) {
    const { state, hidden } = load(root); const b = read(root, batchPath(id));
    assert(b.id === id && b.status !== 'desfet', 'Lot invàlid o ja desfet');
    const acted = b.items.filter(e => b.applied[e.id] && b.applied[e.id].accio !== 'pendent');
    for (const e of acted) {
        const d = state.decisions.find(x => x.id === e.id);
        assert(d && hash(d) === b.applied[e.id].recordHash && !state.pendents.some(x => x.id === e.id), 'Hi ha canvis posteriors per a ' + e.id + ': no es poden sobreescriure');
    }
    for (const e of acted) {
        state.decisions = state.decisions.filter(x => x.id !== e.id); state.revisades = state.revisades.filter(x => x !== e.id);
        const entry = b.applied[e.id].entryBefore;
        assert(entry && entry.id === e.id, 'Falta la còpia anterior de l’entrada'); state.pendents.push(entry);
        if (b.applied[e.id].hiddenAdded) hidden.videoIds = hidden.videoIds.filter(x => x !== e.id);
    }
    b.status = 'desfet'; b.undoneAt = now; b.previousApplied = b.applied; b.applied = {};
    if (!dryRun) {
        const files = { [batchPath(id)]: pack(b), [`${DIR}/${id}.md`]: markdown(b) };
        if (acted.length) { state.updatedAt = now; state.revisades.sort(); files[QUEUE] = serializeQueue(state); files[HIDDEN] = pack(hidden); }
        writeFiles(root, files);
    }
    return { lot: id, restablertes: acted.length, pendents: state.pendents.length, dryRun };
}
function context(root, id) {
    assert(idOK(id), 'ID invàlid'); const { state } = load(root); const entry = state.pendents.find(e => e.id === id);
    assert(entry, 'No és a les pendents');
    const found = [];
    const scan = (v, file) => {
        if (!v || typeof v !== 'object') return;
        if (v.id === id && typeof v.description === 'string') found.push({ fitxer: file, description: v.description, channelId: v.channelId, titol: v.title });
        for (const x of Object.values(v)) if (x && typeof x === 'object') scan(x, file);
    };
    const files = ['data/feed.json', 'data/historial-musical.json', 'data/music-topic-catalog.json'];
    if (/^UC[\w-]{22}$/.test(entry.canalId || '')) files.push(`data/archive/channels/${entry.canalId}.json`);
    for (const file of files) if (fs.existsSync(path.join(root, file))) scan(read(root, file), file);
    return { entrada: entry, url: 'https://www.youtube.com/watch?v=' + id, descripcionsLocals: found, advertiment: 'Metadades locals, no prova de lletra íntegra ni de llengua. No desis textos complets al repositori.' };
}
function parse(args) {
    const [command = 'estat', ...rest] = args;
    assert(['estat', 'prepara', 'aplica', 'desfes', 'context', 'arxiva', 'recupera'].includes(command), 'Ordre desconeguda');
    const opts = {};
    for (const arg of rest) {
        const m = /^--(limit|artista|lot|id)=(.+)$/.exec(arg);
        if (m) { assert(opts[m[1]] === undefined, 'Opció duplicada'); opts[m[1]] = m[2]; }
        else if (arg === '--dry-run') opts.dryRun = true;
        else if (arg === '--reintenta') opts.retry = true;
        else throw new Error('Opció desconeguda: ' + arg);
    }
    const keys = { estat: [], prepara: ['limit', 'artista', 'retry'], aplica: ['lot', 'dryRun'], desfes: ['lot', 'dryRun'], context: ['id'], arxiva: ['lot'], recupera: [] };
    assert(Object.keys(opts).every(k => keys[command].includes(k)), 'Opció no admesa per a aquesta ordre');
    return { command, opts };
}
function run(args, root = process.cwd()) {
    const { command, opts } = parse(args);
    if (command === 'estat') return status(root);
    if (command === 'context') return context(root, opts.id);
    return locked(root, () => {
        if (command === 'recupera') return recover(root);
        assert(!fs.existsSync(path.join(root, '.cache/idiomes-codex-transaction.json')), 'Transacció interrompuda: executa recupera.');
        if (command === 'prepara') return prepare(root, { limit: opts.limit === undefined ? 50 : Number(opts.limit), artist: opts.artista, retry: opts.retry });
        if (command === 'aplica') return apply(root, opts.lot, opts);
        if (command === 'desfes') return undo(root, opts.lot, opts);
        const b = read(root, batchPath(opts.lot)); assert(b.status === 'obert', 'Només es pot arxivar un lot obert');
        b.status = 'arxivat'; writeFiles(root, { [batchPath(b.id)]: pack(b), [`${DIR}/${b.id}.md`]: markdown(b) });
        return { arxivat: b.id, nota: 'Les entrades no resoltes continuen pendents.' };
    });
}
module.exports = { run, validate, fingerprint, POLICY };
if (require.main === module) {
    try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
    catch (error) { console.error('ERROR: ' + error.message); process.exitCode = 1; }
}
