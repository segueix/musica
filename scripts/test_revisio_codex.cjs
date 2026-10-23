'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, POLICY } = require('./revisar_idiomes_codex.cjs');
const Q = 'data/revisio-idiomes.json', H = 'data/hidden-videos.json';
const BP = 'docs/revisions/idiomes-codex/lot-0001.json';
const write = (r, p, x) => { fs.mkdirSync(path.dirname(path.join(r, p)), { recursive: true }); fs.writeFileSync(path.join(r, p), JSON.stringify(x, null, 2) + '\n'); };
const read = (r, p) => JSON.parse(fs.readFileSync(path.join(r, p), 'utf8'));
const bytes = (r, p) => fs.readFileSync(path.join(r, p), 'utf8');
function setup(t, n = 3) {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'idiomes-codex-')); t.after(() => fs.rmSync(r, { recursive: true, force: true }));
    const pendents = Array.from({ length: n }, (_, i) => ({ id: 'video' + String(i + 1).padStart(6, '0'), artista: i === 1 ? 'Artista B' : 'Artista A', artistaId: i === 1 ? 'b' : 'a', canalId: 'UC' + 'a'.repeat(22), titol: `Peça ${i + 1}`, tipus: 'song', descripcio: 'Metadades, no una lletra.' }));
    write(r, Q, { updatedAt: '2026-10-01T00:00:00Z', pendents, revisades: ['existing001'], decisions: [{ id: 'existing001', accio: 'conserva', font: 'https://artist.example/old' }], acceptadesPerArtista: [{ id: 'trusted0001' }], custom: { keep: true } });
    write(r, H, { updatedAt: '2026-09-01', videoIds: ['hidden00001'], custom: true });
    return r;
}
function prepare(r, opts = []) { return run(['prepara', ...opts], r); }
function setDecisions(r, ds) { const b = read(r, BP); b.decisions = ds; write(r, BP, b); }
function source(extra = {}) { return { url: 'https://artist.example/song', consultada: new Date().toISOString(), llegida: true, coincidenciaVersio: true, ...extra }; }
function keep(id = 'video000001', extra = {}) { return { id, accio: 'conserva', metode: 'lletra-completa', llengues: ['ca'], motiu: 'Lletra completa llegida i versió identificada a la font.', fonts: [source()], lletraCompletaLlegida: true, ...extra }; }
const pending = id => ({ id, accio: 'pendent', motiu: 'La font no és accessible; falta comprovar la lletra.', fonts: [] });
const apply = (r, args = []) => run(['aplica', '--lot=lot-0001', ...args], r);

test('preparar no altera el catàleg i alterna artistes', t => {
    const r = setup(t); const before = bytes(r, Q), hidden = bytes(r, H); prepare(r, ['--limit=2']);
    const b = read(r, BP); assert.deepEqual(b.items.map(e => e.artista), ['Artista A', 'Artista B']); assert.equal(b.decisions.length, 0);
    assert.equal(bytes(r, Q), before); assert.equal(bytes(r, H), hidden);
});
test('continua reprèn el mateix lot sense repetir ni canviar el límit', t => {
    const r = setup(t); prepare(r, ['--limit=1']); assert.equal(prepare(r, ['--limit=100']).repren, 'lot-0001');
    assert.equal(read(r, BP).items.length, 1);
});
test('estat reflecteix el recompte real, no una constant', t => { const r = setup(t, 7); assert.equal(run(['estat'], r).pendents, 7); });
test('dry-run valida però no escriu cap fitxer del catàleg ni el lot', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); const before = [Q, H, BP].map(p => bytes(r, p));
    assert.equal(apply(r, ['--dry-run']).despres, 2); assert.deepEqual([Q, H, BP].map(p => bytes(r, p)), before);
});
test('aplicació parcial real i idempotent preserva la resta', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); const a = apply(r); assert.equal(a.conservades, 1); assert.equal(a.senseExaminarAlLot, 2);
    const q = read(r, Q); assert.deepEqual(q.custom, { keep: true }); assert.equal(q.acceptadesPerArtista.length, 1); assert.equal(q.decisions[0].id, 'existing001');
    assert.equal(q.decisions[1].politica, POLICY); assert.equal(q.decisions[1].lletraIntegraVerificada, true); assert.equal(q.decisions[1].reutilitza, false);
    assert.equal(apply(r).omesesJaAplicades, 1); assert.equal(read(r, Q).decisions.length, 2);
});
test('cançó mixta amb català es conserva', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep(undefined, { llengues: ['ca', 'es'] })]); assert.equal(apply(r).conservades, 1);
});
test('exclusió per lletra íntegra sense català afegeix només aquell ID', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep(undefined, { accio: 'amaga', metode: 'lletra-completa', llengues: ['es'], lletraCompletaLlegida: true })]);
    assert.equal(apply(r).amagades, 1); assert.deepEqual(read(r, H).videoIds, ['hidden00001', 'video000001']); assert.equal(read(r, Q).decisions[1].lletraIntegraVerificada, true);
});
for (const [name, patch, pattern] of [
    ['no permet conservar per confiança', { metode: 'confianca-artista' }, /Mètode no admès/],
    ['no accepta títol sense identificar', { metode: 'titol-catala' }, /títol català inequívoc/],
    ['no accepta lletra incompleta com a completa', { lletraCompletaLlegida: false }, /lletra íntegra/],
    ['no accepta font no llegida', { fonts: [source({ llegida: false })] }, /llegir la font/],
    ['no accepta versió sense identificar', { fonts: [source({ coincidenciaVersio: false })] }, /comprovar la versió/],
    ['no accepta font absent', { fonts: [] }, /sense fonts/],
    ['no accepta clau a URL', { fonts: [source({ url: 'https://artist.example/?api_key=secret' })] }, /credencials/],
    ['no accepta data futura', { fonts: [source({ consultada: '2099-01-01' })] }, /futura/],
    ['no accepta font local', { fonts: [source({ url: 'https://localhost/test' })] }, /pública/],
    ['no permet adjuntar lletres completes', { lyrics: 'text de la lletra' }, /desconegut/],
    ['llengua desconeguda no és un resultat', { llengues: ['und'] }, /Llengües identificades/],
]) test(name, t => { const r = setup(t); prepare(r); setDecisions(r, [keep(undefined, patch)]); assert.throws(() => apply(r), pattern); assert.equal(read(r, Q).pendents.length, 3); });
test('instrumental requereix documentació positiva', t => {
    const r = setup(t); prepare(r); const d = keep(undefined, { metode: 'instrumental-documentat', llengues: ['zxx'], lletraCompletaLlegida: false }); setDecisions(r, [d]);
    assert.throws(() => apply(r), /instrumentalitat/); d.instrumentalComprovat = true; setDecisions(r, [d]); assert.equal(apply(r).conservades, 1);
});
test('disc documentat exigeix edició i no marca lletra llegida', t => {
    const r = setup(t); prepare(r); const d = keep(undefined, { metode: 'disc-documentat', lletraCompletaLlegida: false }); setDecisions(r, [d]); assert.throws(() => apply(r), /edició/);
    d.edicio = 'Edició identificada del segell: referència TEST-001'; setDecisions(r, [d]); apply(r); assert.equal(read(r, Q).decisions[1].lletraIntegraVerificada, false);
});
test('mateix títol o decisió antiga no hereten validació estricta', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep(undefined, { metode: 'mateix-enregistrament', lletraCompletaLlegida: false, decisioOrigen: 'existing001', correspondencia: 'Suposada coincidència només pel títol' })]); assert.throws(() => apply(r), /mateixa política/);
});
test('un dubte examinat continua pendent però no es repeteix automàticament', t => {
    const r = setup(t, 1); prepare(r); setDecisions(r, [pending('video000001')]); const q = bytes(r, Q); apply(r);
    assert.equal(bytes(r, Q), q); assert.equal(run(['estat'], r).examinadesSenseProves, 1); assert.equal(prepare(r).preparades, 0);
    assert.equal(prepare(r, ['--reintenta']).lot, 'lot-0002');
});
test('un pendent no pot contenir afirmacions de lletra verificada', t => {
    const r = setup(t); prepare(r); setDecisions(r, [{ ...pending('video000001'), lletraCompletaLlegida: true }]); assert.throws(() => apply(r), /afirmacions/);
});
test('un pendent tampoc no exporta URLs amb tokens', t => {
    const r = setup(t); prepare(r); setDecisions(r, [{ ...pending('video000001'), fonts: [source({ url: 'https://artist.example/?token=x' })] }]); assert.throws(() => apply(r), /credencials/);
});
test('IDs aliens al lot i duplicats s’aturen abans de qualsevol canvi', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep(), keep('other000001')]); assert.throws(() => apply(r), /fora del lot/); assert.equal(read(r, Q).pendents.length, 3);
    setDecisions(r, [keep(), keep()]); assert.throws(() => apply(r), /duplicades/);
});
test('un canvi d’identitat invalida només aquell lot, no s’aplica en silenci', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); const q = read(r, Q); q.pendents[0].canalId = 'UC' + 'b'.repeat(22); write(r, Q, q);
    assert.throws(() => apply(r), /cua ha canviat/);
});
test('una decisió manual nova no se sobreescriu', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); const q = read(r, Q); q.decisions.push({ id: 'video000001', accio: 'amaga' }); write(r, Q, q); assert.throws(() => apply(r), /decisió manual/);
});
test('un altre artista o updatedAt nou no invaliden un lot vàlid', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); const q = read(r, Q); q.updatedAt = new Date().toISOString(); q.decisions.push({ id: 'other000001', accio: 'conserva' }); write(r, Q, q); assert.equal(apply(r).conservades, 1);
});
test('no recupera ocults ni canals bloquejats', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); write(r, 'data/music-channel-video-allowlist.json', { channels: { ['UC' + 'a'.repeat(22)]: { blocked: true } } }); assert.throws(() => apply(r), /bloquejat/);
    write(r, 'data/music-channel-video-allowlist.json', { channels: {} }); const h = read(r, H); h.videoIds.push('video000001'); write(r, H, h); assert.throws(() => apply(r), /ocult/);
});
test('desfer restaura la descripció vigent en aplicar, no una còpia antiga', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); const q = read(r, Q); q.pendents[0].descripcio = 'Metadades actualitzades després de preparar.'; write(r, Q, q);
    apply(r); assert.equal(run(['desfes', '--lot=lot-0001'], r).restablertes, 1); assert.equal(read(r, Q).pendents.find(e => e.id === 'video000001').descripcio, q.pendents[0].descripcio);
});
test('desfer una exclusió treu només l’ocult afegit pel lot', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep(undefined, { accio: 'amaga', llengues: ['es'] })]); apply(r); run(['desfes', '--lot=lot-0001'], r); assert.deepEqual(read(r, H).videoIds, ['hidden00001']);
});
test('desfer no trepitja decisions posteriors', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep()]); apply(r); const q = read(r, Q); q.decisions[1].motiu = 'Revisió manual posterior'; write(r, Q, q); assert.throws(() => run(['desfes', '--lot=lot-0001'], r), /canvis posteriors/);
});
test('arxivar allibera entrades no examinades sense validar-les', t => {
    const r = setup(t); prepare(r); run(['arxiva', '--lot=lot-0001'], r); assert.equal(prepare(r).lot, 'lot-0002'); assert.equal(read(r, Q).pendents.length, 3);
});
test('context recupera la descripció local sencera sense xarxa', t => {
    const r = setup(t); const full = 'Descripció sintètica llarga. '.repeat(100); write(r, 'data/feed.json', { videos: [{ id: 'video000001', description: full }] });
    assert.equal(run(['context', '--id=video000001'], r).descripcionsLocals[0].description, full);
});
test('bloqueig impedeix dues escriptures simultànies', t => {
    const r = setup(t); fs.mkdirSync(path.join(r, '.cache')); fs.writeFileSync(path.join(r, '.cache/idiomes-codex.lock'), ''); assert.throws(() => prepare(r), /bloqueig/);
});
test('transacció interrompuda es recupera sense aplicar una decisió parcial', t => {
    const r = setup(t); const before = bytes(r, Q); const after = JSON.stringify({ parcial: true }); fs.writeFileSync(path.join(r, Q), after);
    write(r, '.cache/idiomes-codex-transaction.json', [{ file: Q, before, after }]); assert.equal(run(['recupera'], r).recuperada, true); assert.equal(bytes(r, Q), before);
});
test('recuperació no toca fitxers alterats per un altre procés', t => {
    const r = setup(t); write(r, '.cache/idiomes-codex-transaction.json', [{ file: Q, before: 'a', after: 'b' }]); assert.throws(() => run(['recupera'], r), /canvis posteriors/);
});
test('opcions, IDs de lot i límits invàlids es rebutgen', t => {
    const r = setup(t); for (const n of ['0', '101', 'NaN', '1.5']) assert.throws(() => prepare(r, ['--limit=' + n]), /Límit/);
    assert.throws(() => run(['aplica', '--lot=../../x'], r), /invàlid/); assert.throws(() => run(['prepara', '--dry-run'], r), /Opció/);
});
test('implementació sense clients de xarxa ni credencials d’IA', () => {
    const text = fs.readFileSync(path.join(__dirname, 'revisar_idiomes_codex.cjs'), 'utf8');
    assert.doesNotMatch(text, /\bfetch\s*\(|require\(['"](?:https?|openai|axios)['"]\)|OPENAI_API_KEY|api\.openai\.com/);
});

test('títol català resol sense inventar llengües cantades ni lletra llegida', t => {
    const r = setup(t); prepare(r);
    setDecisions(r, [keep(undefined, { metode: 'titol-catala', titolCatala: 'Peça 1', llengues: [], lletraCompletaLlegida: false })]);
    assert.equal(apply(r).conservades, 1);
    const d = read(r, Q).decisions[1]; assert.equal(d.lletraIntegraVerificada, false); assert.deepEqual(d.llengues, []); assert.equal(d.titolCatala, 'Peça 1');
});
test('títol català no permet afirmar lectura de lletra ni un títol diferent', t => {
    const r = setup(t); prepare(r);
    setDecisions(r, [keep(undefined, { metode: 'titol-catala', titolCatala: 'Peça 1', llengues: [] })]);
    assert.throws(() => apply(r), /no certifica/);
    setDecisions(r, [keep(undefined, { metode: 'titol-catala', titolCatala: 'Altra peça', llengues: [], lletraCompletaLlegida: false })]);
    assert.throws(() => apply(r), /mateixa entrada/);
});
test('fragment català permet conservar lletra parcial amb altres llengües', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep(undefined, { metode: 'fragment-catala', llengues: ['ca', 'en'], lletraCompletaLlegida: false, fragmentCantatComprovat: true })]);
    assert.equal(apply(r).conservades, 1); assert.equal(read(r, Q).decisions[1].lletraIntegraVerificada, false);
});
test('una llengua estrangera sola no aprova i un fragment estranger no exclou', t => {
    const r = setup(t); prepare(r); setDecisions(r, [keep(undefined, { llengues: ['en'] })]); assert.throws(() => apply(r), /Cal català/);
    setDecisions(r, [keep(undefined, { accio: 'amaga', llengues: ['ca', 'en'] })]); assert.throws(() => apply(r), /No es pot excloure/);
    setDecisions(r, [keep(undefined, { accio: 'amaga', metode: 'fragment-no-catala', llengues: ['en'], lletraCompletaLlegida: false, fragmentCantatComprovat: true })]); assert.throws(() => apply(r), /Mètode no admès/);
});
test('els lots històrics mantenen política i decisions sense reaplicar-les', t => {
    const r = setup(t); prepare(r); setDecisions(r, [pending('video000001')]); apply(r);
    const b = read(r, BP); b.policy = 'catala-estricte-v1'; write(r, BP, b);
    assert.equal(run(['estat'], r).examinadesSenseProves, 1); assert.throws(() => apply(r), /Lot invàlid/);
    run(['arxiva', '--lot=lot-0001'], r); assert.match(bytes(r, BP.replace('.json', '.md')), /catala-estricte-v1/);
});
