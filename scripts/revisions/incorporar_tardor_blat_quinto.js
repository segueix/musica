'use strict';

// Alta editorial delimitada a la fotografia de YouTube del 12-10-2026.
// No és un descobridor automàtic: cap vídeo futur ni homònim s'aprova per nom.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);
const REPORT = 'docs/revisions/2026-10-12-tardor-blat-quinto.json';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const norm = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = (values) => [...new Set(values)];
const KNOWN_BILINGUAL = ['ql53lHBpHDI', 'jfO-YY-q6Do', 'f5kNt3okLEQ', 'R1rlHiuWYlg'];
const SOURCES = {
    tardor: [
        'https://tardor.band/',
        'https://www.pro21cultural.com/project/tardor/',
        'https://www.enderrock.cat/noticia/23805/mural-sonor-pais-valencia-canta',
        'https://www.enderrock.cat/noticia/30622/canco-tardor-es-canta-ara-quatre-llengues-europees-minoritzades',
    ],
    blat: [
        'https://www.enderrock.cat/noticia/27814/alex-blat-volia-fugir-competencia-entre-bandes-perque-ja-estava-molt-cansat',
        'https://www.primaveradh.com/tenda/val/producte/alex-blat-cd-la-veritat/',
        'https://www.enderrock.cat/noticia/22955/alex-blat-he-intentat-fer-album-molt-senzill-molt-organic-molt-pur',
        'https://www.youtube.com/watch?v=jfO-YY-q6Do',
    ],
    quinto: [
        'https://www.pro21cultural.com/project/quinto/',
        'https://www.enderrock.cat/noticia/28143/quinto-demostra-versatilitat-ep-debut',
        'https://www.enderrock.cat/noticia/30990/quinto-vivim-renaixement-feixisme-mort-cultura-nostre-pais',
        'https://www.enderrock.cat/noticia/31971/noves-cancons-catala-son-mar-pujol-max-navarro-mazoni-pep-gimeno-botifarra',
    ],
};
const CONFIG = [
    { name: 'Tardor', key: 'artist:tardor', genres: ['Pop', 'Rock'], aliases: [],
      official: 'UCfVobdq05T0LJLrCIUbwqYQ', topic: 'UCmnRoubcIKBdSZfa12Sh08w',
      place: 'València', placeId: 'geonames:2509954', sources: SOURCES.tardor,
      basis: 'Formació de València documentada pel grup i la seva agència. No es confon amb bandes homònimes.',
      watch: 'Versió Trovam EUxChange multilingüe exclosa. Alta tancada als enregistraments seleccionats; les novetats requereixen revisió.' },
    { name: 'Àlex Blat', key: 'artist:alex-blat', genres: ["Cançó d'autor", 'Pop'], aliases: ['Alex Blat', 'Àlex Martínez Orts', 'Alexandre Martínez Orts'],
      official: 'UCqXrOm2JFPasb_oKqguIm4g', topic: 'UC6SBLhrf0nLYU-_a9iqwWqw',
      place: 'Benidorm', sources: SOURCES.blat,
      basis: 'L’entrevista directa identifica Benidorm com a origen; l’artista explica que hi va viure fins als vuit anys i després es traslladà a València. Projecte independent de Tardor.',
      watch: 'L’Oblit amb Ciudad Jara conté estrofes en castellà: se n’exclouen les tres gravacions localitzades. Revisió de futures col·laboracions.' },
    { name: 'Quinto', key: 'artist:quinto', genres: ['Urbana', 'Rap / Hip-hop', 'Pop'], aliases: ['Josep Quinto', 'Josep Quinto Mengual'],
      official: 'UCbJVlPOepjJiteagmmSaoTA', topic: 'UCFPGW7hAaXSfcPueygR_25A',
      place: 'Pego', placeId: 'geonames:6559502', sources: SOURCES.quinto,
      basis: 'La fitxa de l’agència identifica Josep Quinto com a originari de Pego, a la Marina Alta. Els crèdits permeten separar-lo dels homònims.',
      watch: 'Canal Tema compartit amb homònims. Només IDs amb identitat Josep Quinto Mengual i repertori contrastat; no s’importa el catàleg d’Alex Quinto Fernandez / Atlas Club.' },
];
const TARDOR_OTHER = new Set([
    'XUQmtzMGCDk', 'UGDwNXvX3mE', '7RjIbcCC4SI', 'KAksj3-Ep6Q', 'sKoYUq3JBjE',
    'ue-1_aJJuAs', 'CG4smoXo0Q8', 'Y786ubif_Mk', 'paj4wo3W2H8', 'oIjBfsZzMEQ',
    'Uvv7TkViBxg', 'Fm3uBOdZTz0', 'Yte05fJk-rs',
]);
const QUINTO_OFFICIAL = new Set([
    'rzB9WKiJ5yo', 'xU3V8leUuLo', 'YczVUOIUfis', 'IM4wvzBPPdU', 'KgZE8GqcBs4',
    '3EAVNINpr_E', 'Z2qnwQTvOv0', 'xhmohD1DNdA', 'GPlUi9Sv_3w', 'uihhZVfjvd8',
    '9q_RNT2lua0', 'YFrUsZROcD8', 'Ftq9IH_wBcc', 'lQa8mEAj_X8', 'hsrcgs0aa2k',
]);
const QUINTO_WORKS = new Set([
    'CASTIGAT', 'LLUM', 'QUÈ DIR-TE?', 'No Hi Ha Res Urgent', 'UELCOM TU DE PARADAIS',
    'Les Hores Mortes', 'PÀNIC', 'Demà Canvie De Vida', '1DELSNOSTRES', 'ZKITTLEZ',
    'A Punt De Perdre', 'ACCIÒMO', 'CAIGUDA LLIURE', 'Marrons', 'SENSE SENYAL',
    'Ara què fem?', '128', 'Ethos', 'Però', 'Petjades', 'Blanc i negre', 'Tota la nit',
].map(norm));
function seconds(iso) {
    const m = String(iso || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    return m ? Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0) : 0;
}
function exclusion(config, channel, video) {
    if (KNOWN_BILINGUAL.includes(video.id)) return 'Lletra bilingüe o multilingüe contrastada; no compleix el criteri del català.';
    if (!/^[A-Za-z0-9_-]{11}$/.test(video.id) || video.channelId !== channel.id) return 'Identificador o editor real no coincideix.';
    if (!video.embeddable) return 'YouTube no permet inserir aquesta gravació.';
    const region = video.regionRestriction;
    if (region?.blocked?.includes('ES') || (region?.allowed && !region.allowed.includes('ES'))) return 'Gravació no disponible a Espanya.';
    const duration = seconds(video.duration);
    if (!duration || duration > 900) return 'No és una cançó individual de durada contrastada.';
    if (config.name === 'Tardor') {
        if (channel.id === config.official && TARDOR_OTHER.has(video.id)) return 'Anunci, promoció, documental, concert complet o enregistrament encara no seleccionat.';
    } else if (config.name === 'Àlex Blat') {
        if (video.id === 'JdpDATUyack') return 'Tràiler, no la cançó completa.';
    } else if (channel.id === config.official) {
        if (!QUINTO_OFFICIAL.has(video.id)) return 'Promoció, fragment breu o sessió encara no contrastada per al catàleg.';
    } else {
        const description = norm(video.description);
        if (!description.includes('josep quinto mengual') || !description.includes('primavera d hivern')) return 'Homònim o identitat de l’enregistrament no acreditada com Josep Quinto Mengual.';
        if (!QUINTO_WORKS.has(norm(video.title))) return 'Obra encara no contrastada; no s’aprova només pel nom del canal.';
    }
    return null;
}
function contentType(video) {
    if (video.id === '8KeF3Je5Zas' || /en directe|video directe|balco de l ajuntament/.test(norm(video.title))) return 'live_song';
    return 'song';
}
async function resolveBenidorm(origins) {
    const existing = Object.entries(origins.places).find(([, p]) => norm(p.name) === 'benidorm' && p.type === 'municipality');
    if (existing) return existing[0];
    const url = 'https://geocoding-api.open-meteo.com/v1/search?name=Benidorm&count=10&language=ca&format=json&countryCode=ES';
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('No es pot verificar la coordenada de Benidorm: ' + response.status);
    const data = await response.json();
    const place = data.results?.find(p => norm(p.name) === 'benidorm' && p.country_code === 'ES' && String(p.feature_code).startsWith('PPL'));
    assert(place && Number.isInteger(place.id), 'No hi ha una referència municipal inequívoca de Benidorm');
    assert(place.latitude > 37 && place.latitude < 40 && place.longitude > -1 && place.longitude < 1, 'Coordenades fora de l’àmbit de Benidorm');
    const id = 'geonames:' + place.id;
    assert(!origins.places[id], 'El nou identificador ja correspon a un altre lloc');
    origins.places[id] = {name:'Benidorm', type:'municipality', geonamesId:place.id,
        coordinates:{latitude:place.latitude, longitude:place.longitude, precision:'settlement_reference'},
        territory:'País Valencià', source:url, checkedOn:'2026-10-12'};
    return id;
}
function verifyPublished() {
    const report = read(REPORT);
    const channels = read('js/channels-ca.json').channels;
    const feed = read('data/feed.json').videos;
    const base = read('data/artistes-musica.json');
    const origins = read('data/origens-artistes.json');
    let recorded = 0;
    for (const artist of report.artists) {
        const canonical = base.artists.filter(a => a.name === artist.name && a.active && a.reviewStatus === 'aprovat');
        assert.equal(canonical.length, 1, artist.name + ': alta activa única');
        const published = [];
        for (const channel of artist.channels) {
            assert(channels.some(c => c.id === channel.id), channel.id + ': canal no publicat');
            assert(origins.artists[origins.channels[channel.id]].name === artist.name, 'Origen no resoluble');
            const archivePath = 'data/archive/channels/' + channel.id + '.json';
            const archive = fs.existsSync(archivePath) ? read(archivePath).videos : [];
            const hot = feed.filter(v => v.channelId === channel.id);
            const all = [...new Map([...archive, ...hot].map(v => [v.id, v])).values()];
            const allowed = new Set(channel.allowedVideoIds);
            assert(all.length > 0, channel.id + ': sense enregistraments publicats');
            assert(all.every(v => allowed.has(v.id) && !KNOWN_BILINGUAL.includes(v.id)), 'Ha entrat un vídeo no seleccionat');
            assert(fs.existsSync('compartir/artista/' + channel.id + '.html'), 'Falta la pàgina de l’artista');
            const result = {id:channel.id, type:channel.type, hot:hot.length, archive:archive.length, recordings:all.length};
            published.push(result);
            recorded += all.length;
        }
        artist.publication = published;
        artist.recordingsPublished = published.reduce((n, p) => n + p.recordings, 0);
    }
    assert(!channels.some(c => c.id === 'UC9zX7R05JQ1P30RGvtjHizQ'), 'Teresa Sanna no s’ha de reincorporar');
    assert(feed.every(v => !KNOWN_BILINGUAL.includes(v.id)), 'Una exclusió lingüística és al feed');
    report.publication = {checkedAt:new Date().toISOString(), recordingsPublished:recorded, activeArtists:3,
        targetChannels:6, status:'verified', note:'Compta enregistraments i versions, no composicions úniques. Catàleg, arxiu i pàgines compartides comprovats.'};
    write(REPORT, report);
    console.log(JSON.stringify(report.publication));
}
async function apply() {
    const now = new Date().toISOString();
    const discovery = read('docs/revisions/2026-10-12-tardor-blat-quinto-descoberta.json');
    const base = read('data/artistes-musica.json');
    const origins = read('data/origens-artistes.json');
    const allow = read('data/music-channel-video-allowlist.json');
    const watch = read('data/artistes-vigilats-idioma.json');
    const types = read('data/music-content-overrides.json');
    const names = read('data/noms-canals.json');
    const hidden = read('data/hidden-videos.json');
    const language = read('data/revisio-idiomes.json');
    const shorts = read('data/falsos-shorts.json');
    const report = {schemaVersion:1, reviewedOn:'2026-10-12', generatedAt:now,
        method:'Identitat pels canals facilitats, editor real i crèdits de distribució. Selecció documental de repertori i contrast de les lletres oficials disponibles. No s’ha fet una escolta íntegra de totes les pistes. Llistes tancades per ID.',
        artists:[], languageExclusions:KNOWN_BILINGUAL, pendingChannels:[{id:'UCzqxLyTRSy6pgyruKRcv6XQ', artist:'Tardor', reason:'Tema secundari amb dues pistes; no s’incorpora sense contrast addicional d’identitat i llengua.'}], preservedRemovals:[]};
    for (const config of CONFIG) {
        const found = discovery.artists.find(a => a.name === config.name);
        assert(found && found.officialId === config.official, 'Canal oficial no acreditat: ' + config.name);
        const selectedChannels = [config.topic, config.official].map(id => {
            const channel = found.channels.find(c => c.id === id);
            assert(channel && channel.complete, 'Fotografia incompleta: ' + id);
            return channel;
        });
        const activeIds = selectedChannels.map(c => c.id);
        const existing = base.artists.filter(a => [a.name, a.displayName, ...(a.aliases || [])].some(name => norm(name) === norm(config.name)));
        assert(existing.length <= 1, 'Hi ha registres duplicats: ' + config.name);
        const artist = existing[0] || {wikidataId:null, musicbrainzId:null, aliases:[], sources:[], youtube:{channels:[]}};
        assert(!(artist.youtube?.channels || []).some(c => !activeIds.includes(c.id)), 'Cal reconciliar canals previs abans de substituir-los');
        const previousOrigin = Object.entries(origins.artists).filter(([, a]) => norm(a.name) === norm(config.name));
        assert(previousOrigin.length <= 1, 'Orígens duplicats: ' + config.name);
        const originKey = previousOrigin[0]?.[0] || config.key;
        const placeId = config.placeId || await resolveBenidorm(origins);
        assert(origins.places[placeId], 'Lloc inexistent: ' + placeId);
        Object.assign(artist, {name:config.name, displayName:config.name,
            aliases:unique([...(artist.aliases || []), ...config.aliases]), genres:config.genres,
            territories:['País Valencià'], languages:['català'], sources:unique([...(artist.sources || []), ...config.sources]),
            confidence:'alta', reviewStatus:'aprovat', active:true, lastChecked:'2026-10-12',
            notes:config.watch + ' Vegeu ' + REPORT});
        artist.youtube = {...artist.youtube, channels:selectedChannels.map(c => ({id:c.id, handle:c.handle,
            name:c.name, type:c.id === config.topic ? 'topic' : 'official', primary:c.id === config.topic}))};
        if (!existing.length) base.artists.push(artist);
        origins.artists[originKey] = {...origins.artists[originKey], name:config.name, status:'validated', relation:'origin',
            placeIds:[placeId], confidence:'alta', basis:config.basis, sources:[config.sources[0]],
            reviewedOn:'2026-10-12', assignmentSource:'manual-review', locked:true};
        const evidence = {name:config.name, origin:config.place, originId:placeId, genres:config.genres,
            sources:config.sources, channels:[], excludedRecordings:[]};
        for (const channel of selectedChannels) {
            origins.channels[channel.id] = originKey;
            const accepted = [];
            for (const video of channel.videos) {
                const reason = exclusion(config, channel, video);
                if (reason) {
                    evidence.excludedRecordings.push({id:video.id, title:video.title, channelId:channel.id, reason});
                    continue;
                }
                accepted.push(video);
                const decision = {id:video.id, contentType:contentType(video), title:video.title,
                    note:'Selecció editorial del 12-10-2026; enregistrament complet, editor verificat. ' + REPORT};
                const oldType = types.videos.findIndex(v => v.id === video.id);
                if (oldType < 0) types.videos.push(decision); else types.videos[oldType] = {...types.videos[oldType], ...decision};
                const keep = {id:video.id, accio:'conserva', artista:config.name, titol:video.title,
                    font:config.sources[0], origen:REPORT, data:now};
                language.decisions ||= [];
                const oldDecision = language.decisions.findIndex(d => d.id === video.id);
                assert(oldDecision < 0 || language.decisions[oldDecision].accio !== 'amaga', 'Hi ha una exclusió anterior que cal revisar: ' + video.id);
                if (oldDecision < 0) language.decisions.push(keep);
                language.revisades = unique([...(language.revisades || []), video.id]);
                if (channel.id === config.topic && seconds(video.duration) <= 120) shorts.falseShorts = unique([...(shorts.falseShorts || []), video.id]);
            }
            assert(accepted.length > 0, 'La selecció no conté cançons: ' + channel.id);
            const allowedIds = accepted.map(v => v.id);
            allow.channels[channel.id] = {artist:config.name, note:config.watch + ' ' + REPORT,
                allowedVideoIds:allowedIds, acceptedMusicOnly:true, allowedContentTypes:['song','live_song'],
                ...(config.name === 'Quinto' && channel.id === config.topic ? {avatarVideoId:'przS4BVU8wg'} : {})};
            evidence.channels.push({id:channel.id, name:channel.name, type:channel.id === config.topic ? 'topic' : 'official',
                primary:channel.id === config.topic, selectedRecordings:accepted.length, allowedVideoIds:allowedIds});
        }
        watch.vigilats = (watch.vigilats || []).filter(a => norm(a.artista) !== norm(config.name));
        watch.vigilats.push({artista:config.name, aliases:unique([...config.aliases, ...selectedChannels.map(c => c.name)]),
            canals:activeIds, motiu:config.watch, fonts:config.sources,
            ...(config.name === 'Quinto' ? {canalCompartit:true} : {})});
        watch.confianca = (watch.confianca || []).filter(a => norm(typeof a === 'string' ? a : a.artista) !== norm(config.name));
        report.artists.push(evidence);
    }
    // Respecta la baixa expressa feta en aquest mateix fil: mai no la reobre el regenerador.
    const teresaId = 'UC9zX7R05JQ1P30RGvtjHizQ';
    for (const artist of base.artists) if ((artist.youtube?.channels || []).some(c => c.id === teresaId)) {
        assert((artist.youtube.channels || []).every(c => c.id === teresaId), 'Teresa té altres canals que requereixen revisió');
        artist.active = false;
        artist.reviewStatus = 'rebutjat';
        artist.notes = 'Retirada expressament per l’usuari el 12-10-2026. No reincorporar en sincronitzacions automàtiques.';
        report.preservedRemovals.push({name:artist.name, channelId:teresaId});
    }
    names.overrides['UCbJVlPOepjJiteagmmSaoTA'] = 'Quinto';
    hidden.videoIds = unique([...(hidden.videoIds || []), ...KNOWN_BILINGUAL]);
    for (const id of KNOWN_BILINGUAL) {
        const artist = id === 'ql53lHBpHDI' ? 'Tardor' : 'Àlex Blat';
        const video = discovery.artists.flatMap(a => a.channels).flatMap(c => c.videos).find(v => v.id === id);
        const d = {id, accio:'amaga', artista:artist, titol:video?.title || '',
            font:id === 'ql53lHBpHDI' ? SOURCES.tardor[3] : SOURCES.blat[3], origen:REPORT, data:now};
        language.decisions = [...(language.decisions || []).filter(v => v.id !== id), d];
        language.revisades = unique([...(language.revisades || []), id]);
    }
    const reviewed = new Set(language.revisades);
    for (const key of ['pendents','descartades','acceptadesPerArtista']) language[key] = (language[key] || []).filter(v => !reviewed.has(v.id));
    const targetNames = new Set(CONFIG.map(c => norm(c.name)));
    language.artistesPendents = (language.artistesPendents || []).filter(a => !targetNames.has(norm(a.artista)));
    for (const data of [base, origins, allow, types, language]) data.updatedAt = now;
    watch.updatedAt = '2026-10-12';
    const files = {'data/artistes-musica.json':base, 'data/origens-artistes.json':origins,
        'data/music-channel-video-allowlist.json':allow, 'data/artistes-vigilats-idioma.json':watch,
        'data/music-content-overrides.json':types, 'data/noms-canals.json':names,
        'data/hidden-videos.json':hidden, 'data/revisio-idiomes.json':language, 'data/falsos-shorts.json':shorts};
    for (const [file, data] of Object.entries(files)) write(file, data);
    write(REPORT, report);
    const ids = CONFIG.flatMap(c => [c.topic, c.official]).join(',');
    if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, 'MUSIC_TARGET_CHANNELS=' + ids + '\n');
    console.log(JSON.stringify(report.artists.map(a => ({name:a.name, origin:a.origin,
        channels:a.channels.map(c => ({id:c.id, selected:c.selectedRecordings})), excluded:a.excludedRecordings.length}))));
}
if (require.main === module) {
    (process.argv.includes('--verify') ? Promise.resolve().then(verifyPublished) : apply()).catch(error => {
        console.error(error.stack || error.message); process.exitCode = 1;
    });
}
module.exports = {CONFIG, KNOWN_BILINGUAL, exclusion, contentType};
