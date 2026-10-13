'use strict';

// Alta acotada als dos artistes sol·licitats. Només aprova els enregistraments
// de la consulta desada, mai els futurs ni els homònims pel nom del canal.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
process.chdir(path.resolve(__dirname, '../..'));
const REPORT = 'docs/revisions/2026-10-13-artur-borriana-alta.json';
const SUMMARY = 'docs/revisions/2026-10-13-artur-borriana-alta.md';
const DISCOVERY = 'docs/revisions/2026-10-13-artur-borriana-descoberta.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const norm = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = values => [...new Set(values)];
const ids = text => text.trim().split(/\s+/).filter(Boolean);
const CONFIG = [
    {
        name: 'Artur Àlvarez', aliases: ['Artur Álvarez', 'Artur Alvarez', 'Artur Àlvarez i Boix', 'Artur Álvarez i Boix'],
        key: 'artist:artur-alvarez', genres: ["Cançó d'autor"], place: 'Castelló de la Plana',
        placeAliases: ['Castelló de la Plana', 'Castellón de la Plana'],
        primary: 'UCVYpBf3wwqOh8qNLR8wwK0w', official: 'UCl7wAYdirfC_DZ26TdXBIDw',
        channels: ['UCVYpBf3wwqOh8qNLR8wwK0w', 'UC65z9PhviUEqHbMbW18FwNA', 'UCl7wAYdirfC_DZ26TdXBIDw'],
        albums: ['POESIANA', "D'UN ALTRE MÓN", 'POESIA CANTADA', 'ACORDS VISCUTS', 'TERRA', '10 POETES CONTEMPORANIS', 'LA MAR', 'A RITME DE BLUES', 'ENTRE VERSOS I PINZELLS CONTEMPORANIS', 'A RECER DE LA MAR', 'PAISATGES', 'CASTELLÓ, Triangulada Plana', 'ESTELLÉS a ritme de blues', "A L'OMBRA DE LA MORERA", 'Homenatge a Bernat Artola - Vol 1'],
        officialIds: ids('M_33Pidanpk S_ZffzTjV4I MHQzVoMuuSw nrReH-3p9bg bHOsy9O-NyE HOTFgcEAnVc DU99o8ZTPlI tYqQm-vKAB0 HGDOBirCVQo o1eehcHgmtg ne90UfhxSIs Hib-hCAOdek uqic5oHTfPs gwbAphnpx6Q OLz1b07ygmg WKl_S8s6MyQ EoPHDI0SSnw'),
        liveIds: ids('MHQzVoMuuSw nrReH-3p9bg bHOsy9O-NyE HOTFgcEAnVc'),
        excludedIds: ids('CSQRgTs6y9s q5NlfoK6gZU 0tAHv37ze2Y 1vfjs-TaDhQ D4_CPgNTfMQ IrWBVJ3RtkA RlxxHBS-oCM vwDpuqjM_qs fqJtzYpL3Ek _xJiKRQyMoU'),
        sources: [
            'https://arturalvarez.bandcamp.com/',
            'https://www.musicaenvalencia.es/artista/250/artur-%25c3%2580lvarez',
            'https://arturalvarez.bandcamp.com/album/estell-s-a-ritme-de-blues-2024',
            'https://arturalvarez.bandcamp.com/album/a-lombra-de-la-morera-2023',
            'https://arturalvarez.bandcamp.com/album/pols-del-meu-cam-artur-lvarez-canta-a-bernat-artola-2008',
            'https://arturalvarez.bandcamp.com/album/entre-versos-i-pinzells-contemporanis-2013',
            'https://music.apple.com/us/artist/artur-%C3%A1lvarez/1574030401',
            'https://music.amazon.com/albums/B0G4XHHNM7',
            'https://music.amazon.com/tracks/B0F22MC16S'
        ],
        basis: 'La biografia publicada pel mateix cantautor a Bandcamp identifica Castelló de la Plana com a origen. Els dos canals Tema i el canal propi corresponen a Artur Álvarez i Boix.',
        note: 'Dos canals Tema agrupats: discografia principal i homenatge a Bernat Artola. Repertori català documentat i selecció de 17 gravacions del canal oficial, quatre declarades en directe. Fora recitacions explícites, introduccions i peces amb tipus de contingut pendent; no s’importen indiscriminadament les versions en altres llengües, poemaris ni resums del canal propi.'
    },
    {
        name: 'Borriana Big Band', aliases: ['Borrianabigband', 'Baixamar (Borriana Big Band)'],
        key: 'artist:borriana-big-band', genres: ['Jazz / Blues', 'Folk i arrel'], place: 'Borriana',
        placeAliases: ['Borriana', 'Burriana'], primary: 'UC0mpgagkHjI-FH_66M6sJmA', official: 'UCkpK4wG17WYBZyqjjLqKgHg',
        channels: ['UC0mpgagkHjI-FH_66M6sJmA', 'UCkpK4wG17WYBZyqjjLqKgHg'], albums: ['Peix Enamorat'],
        officialIds: ids('oQJQRBmSY8A q0djJIesNgc jI1AwsOiMeM pgXM1aw0xf4 NHTBx9jDmk0 wQy4cRFKTys uZFfJxyiFZ4 UR6ehRzR6OY jBZ-QjQcKhw NSPIK3r8QDQ tZ6oJbyc6zk M5kSnC-2zqc uX5pRtpI0gQ bvIh0E7R7MQ TmMx0UKE5AQ dQSG0PpCI8o pIluiaIVT6Q 7Gppinu-_cY 1L7MC4sp3J8 3t9aGeUCoT8 UOBuJjzxnEY MvhDk4rRBFo'),
        sources: [
            'https://asociacionbigbands.com/bigband/borriana-big-band/',
            'https://www.valencianmusicoffice.com/en/artist/a4091d8d-ee08-4ba1-ab62-16443ce62529',
            'https://www.verkami.com/projects/24679-nou-disc-baixamar-borriana-big-band',
            'https://www.nomepierdoniuna.net/borriana-big-band-no-deconstruimos-los-hits-en-valenciano-les-damos-sonoridad-de-gran-orquesta/',
            'https://music.amazon.es/albums/B07H5QZ45P',
            'https://music.apple.com/us/album/peix-enamorat/1497706941'
        ],
        basis: 'La presentació del grup a l’Associació de Big Bands identifica Borriana, capital de la Plana Baixa. La fitxa de Valencian Music Office confirma municipi i estils Jazz i Roots.',
        note: 'Tema de Peix enamorat prioritari; D’ací es recupera del canal oficial perquè no s’ha localitzat un Tema inequívoc d’aquest disc. Inclou Qualsevol nit pot sortir el sol instrumental i la versió casolana de Quan caminàvem. Exclosos anuncis, vídeo promocional, Mix Popular i Camí del Senillar pendents de contrast de contingut.'
    }
];
function seconds(value) {
    const m = String(value || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    return m ? Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0) : 0;
}
function albumOf(video) {
    const lines = String(video.description || '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
    return /^provided to youtube/i.test(lines[0] || '') ? lines[2] || '' : '';
}
function reasonFor(config, channel, video) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(video.id || '') || video.channelId !== channel.id) return 'Editor real o identificador no coincident.';
    if (!video.embeddable || video.regionRestriction?.blocked?.includes('ES') ||
        (video.regionRestriction?.allowed && !video.regionRestriction.allowed.includes('ES'))) return 'No disponible per inserció a Espanya.';
    if (seconds(video.duration) <= 0 || seconds(video.duration) > 900) return 'Durada no corresponent a una cançó individual seleccionada.';
    if (config.excludedIds?.includes(video.id)) return 'Recitació explícita, introducció o tipus de contingut pendent de contrast com a cançó.';
    if (channel.id === config.official) {
        if (!config.officialIds.includes(video.id)) return 'Fora de la selecció documental: idioma, contingut o versió encara no contrastats; inclou promocions i recitacions.';
    } else {
        if (!config.albums.map(norm).includes(norm(albumOf(video)))) return 'Disc o edició fora del repertori contrastat.';
        const metadata = norm(video.description);
        if (!metadata.includes(norm(config.name))) return 'La descripció distribuïda no acredita la identitat de l’artista.';
    }
    return null;
}
async function resolvePlace(config, origins) {
    const placeNames = config.placeAliases.map(norm);
    const found = Object.entries(origins.places).find(([, p]) => p.type === 'municipality' && placeNames.includes(norm(p.name)));
    if (found) return found[0];
    for (const name of config.placeAliases) {
        const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
        for (const [k, v] of Object.entries({name, count:10, language:'ca', format:'json', countryCode:'ES'})) u.searchParams.set(k, String(v));
        const r = await fetch(u, {signal:AbortSignal.timeout(30000)});
        if (!r.ok) throw Error('No s’ha pogut comprovar el municipi '+config.place);
        const j = await r.json();
        const p = j.results?.find(p => placeNames.includes(norm(p.name)) && p.country_code === 'ES' && /^PPL/.test(p.feature_code));
        if (!p) continue;
        assert(p.latitude > 39 && p.latitude < 41 && p.longitude > -1 && p.longitude < 1, 'Referència fora de Castelló');
        const key = 'geonames:'+p.id;
        if (!origins.places[key]) origins.places[key] = {name:config.place, type:'municipality', geonamesId:p.id,
            coordinates:{latitude:p.latitude, longitude:p.longitude, precision:'settlement_reference'},
            territory:'País Valencià', source:u.href, checkedOn:'2026-10-13'};
        return key;
    }
    throw Error('No s’ha pogut resoldre '+config.place);
}
async function apply() {
    const snapshot = read(DISCOVERY), now = new Date().toISOString();
    const base = read('data/artistes-musica.json'), origins = read('data/origens-artistes.json');
    const allow = read('data/music-channel-video-allowlist.json'), watch = read('data/artistes-vigilats-idioma.json');
    const types = read('data/music-content-overrides.json'), names = read('data/noms-canals.json');
    const language = read('data/revisio-idiomes.json'), shorts = read('data/falsos-shorts.json');
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    const targetNames = new Set(CONFIG.flatMap(c => [c.name, ...c.aliases]).map(norm));
    const isTarget = a => [a.name, a.displayName, ...(a.aliases || [])].some(n => targetNames.has(norm(n)));
    const unchanged = base.artists.filter(a => !isTarget(a)).map(a => JSON.stringify(a));
    const report = {schemaVersion:1, reviewedOn:'2026-10-13', generatedAt:now,
        method:'Selecció documental de discos, crèdits i descripcions oficials. Llistes tancades per ID, no autorització general del canal. Lletres publicades contrastades en els discos Estellés a ritme de blues i A l’ombra de la morera i en diverses gravacions oficials. No s’ha fet escolta íntegra de tota la discografia ni comprovació integral de cada lletra.', artists:[]};
    for (const config of CONFIG) {
        const found = snapshot.artists.find(a => a.name === config.name);
        assert(found, 'Falta la consulta de '+config.name);
        const selectedChannels = config.channels.map(id => {
            const c = found.channels.find(c => c.id === id);
            assert(c?.complete, 'Consulta incompleta: '+id); return c;
        });
        const relevant = new Set([config.name, ...config.aliases].map(norm));
        const matches = base.artists.filter(a => [a.name, a.displayName, ...(a.aliases || [])].some(n => relevant.has(norm(n))));
        assert(matches.length <= 1, 'Identitat duplicada: '+config.name);
        const artist = matches[0] || {wikidataId:null, musicbrainzId:null, aliases:[], sources:[], youtube:{channels:[]}};
        assert(artist.reviewStatus !== 'rebutjat', 'Cal respectar una baixa anterior: '+config.name);
        assert((artist.youtube?.channels || []).every(c => config.channels.includes(c.id)), 'Cal preservar altres canals previs');
        const originMatches = Object.entries(origins.artists).filter(([, a]) => relevant.has(norm(a.name)));
        assert(originMatches.length <= 1, 'Orígens duplicats');
        const originKey = originMatches[0]?.[0] || config.key;
        const placeId = await resolvePlace(config, origins);
        const canonicalName = matches[0]?.name || config.name;
        Object.assign(artist, {name:canonicalName, displayName:config.name, aliases:unique([...(artist.aliases || []), ...config.aliases]),
            genres:config.genres, territories:['País Valencià'], languages:['català'], sources:unique([...(artist.sources || []), ...config.sources]),
            confidence:'alta', reviewStatus:'aprovat', active:true, lastChecked:'2026-10-13', notes:config.note+' '+REPORT});
        artist.youtube = {...artist.youtube, channels:selectedChannels.map(c => ({id:c.id, handle:c.handle || null, name:c.name,
            type:c.id === config.official ? 'official' : 'topic', primary:c.id === config.primary}))};
        if (!matches.length) base.artists.push(artist);
        origins.artists[originKey] = {...origins.artists[originKey], name:config.name, status:'validated', relation:'origin',
            placeIds:[placeId], confidence:'alta', basis:config.basis, sources:[config.sources[0]], reviewedOn:'2026-10-13', assignmentSource:'manual-review', locked:true};
        const entry = {name:config.name, canonicalName, place:config.place, originId:placeId, genres:config.genres,
            sources:config.sources, note:config.note, channels:[], notSelected:[]};
        for (const channel of selectedChannels) {
            assert(!origins.channels[channel.id] || origins.channels[channel.id] === originKey, 'Canal d’una altra identitat');
            origins.channels[channel.id] = originKey;
            names.overrides[channel.id] = config.name;
            const accepted = [];
            for (const video of channel.videos) {
                const reason = reasonFor(config, channel, video);
                if (reason) {entry.notSelected.push({id:video.id, title:video.title, channelId:channel.id, reason}); continue;}
                assert(!hidden.has(video.id), 'No es pot recuperar un vídeo ocult sense revisió: '+video.id);
                const previous = (language.decisions || []).find(d => d.id === video.id);
                assert(previous?.accio !== 'amaga', 'Hi ha una exclusió de llengua anterior');
                accepted.push(video);
                const decision = {id:video.id, contentType:config.liveIds?.includes(video.id) ? 'live_song' : 'song', title:video.title,
                    note:'Enregistrament complet de la selecció documental; editor contrastat. '+REPORT};
                const index = types.videos.findIndex(v => v.id === video.id);
                if (index < 0) types.videos.push(decision); else types.videos[index] = {...types.videos[index], ...decision};
                language.decisions ||= [];
                if (!previous) language.decisions.push({id:video.id, accio:'conserva', artista:config.name, titol:video.title,
                    font:channel.id === config.official ? 'https://www.youtube.com/watch?v='+video.id : config.sources[1],
                    origen:REPORT, data:now, criteri:'seleccio-documental', lletraIntegraVerificada:false});
                if (channel.id !== config.official && seconds(video.duration) <= 120) shorts.falseShorts = unique([...(shorts.falseShorts || []), video.id]);
            }
            assert(accepted.length, 'Canal sense cançons seleccionades: '+channel.id);
            const allowedVideoIds = accepted.map(v => v.id);
            allow.channels[channel.id] = {artist:config.name, note:config.note+' '+REPORT, allowedVideoIds,
                acceptedMusicOnly:true, allowedContentTypes:['song','live_song']};
            entry.channels.push({id:channel.id, type:channel.id === config.official ? 'official' : 'topic',
                primary:channel.id === config.primary, selected:allowedVideoIds.length, allowedVideoIds});
        }
        watch.vigilats = (watch.vigilats || []).filter(a => !relevant.has(norm(a.artista)));
        watch.vigilats.push({artista:config.name, aliases:unique([...config.aliases, ...selectedChannels.map(c => c.name)]),
            canals:config.channels, motiu:config.note, fonts:config.sources});
        watch.confianca = (watch.confianca || []).filter(a => !relevant.has(norm(typeof a === 'string' ? a : a.artista)));
        report.artists.push(entry);
    }
    assert.deepEqual(base.artists.filter(a => !isTarget(a)).map(a => JSON.stringify(a)), unchanged, 'S’ha modificat un altre artista');
    report.preservedOtherArtists = unchanged.length;
    for (const obj of [base, origins, allow, types, language]) obj.updatedAt = now;
    watch.updatedAt = '2026-10-13';
    for (const [file, obj] of Object.entries({'data/artistes-musica.json':base, 'data/origens-artistes.json':origins,
        'data/music-channel-video-allowlist.json':allow, 'data/artistes-vigilats-idioma.json':watch,
        'data/music-content-overrides.json':types, 'data/noms-canals.json':names,
        'data/revisio-idiomes.json':language, 'data/falsos-shorts.json':shorts})) write(file, obj);
    write(REPORT, report);
    const targets = CONFIG.flatMap(c => c.channels);
    assert.equal(new Set(targets).size, 5);
    if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, 'MUSIC_TARGET_CHANNELS='+targets.join(',')+'\n');
    console.log(JSON.stringify(report.artists.map(a => ({name:a.name, selected:a.channels.reduce((n,c) => n+c.selected,0), excluded:a.notSelected.length}))));
}
function verify() {
    const report = read(REPORT), feed = read('data/feed.json'), base = read('data/artistes-musica.json');
    const channels = read('js/channels-ca.json').channels, origins = read('data/origens-artistes.json');
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    const {cleanTitle} = require('../../js/song-title.js');
    let total = 0;
    for (const artist of report.artists) {
        const canonical = base.artists.filter(a => a.name === artist.canonicalName && a.active && a.reviewStatus === 'aprovat');
        assert.equal(canonical.length, 1, 'Una sola identitat activa');
        assert.equal(canonical[0].youtube.channels.filter(c => c.primary).length, 1, 'Un únic canal principal');
        let count = 0;
        for (const channel of artist.channels) {
            assert(channels.some(c => c.id === channel.id), 'Canal no publicat');
            assert.equal(origins.artists[origins.channels[channel.id]].name, artist.name);
            const file = 'data/archive/channels/'+channel.id+'.json';
            const archive = fs.existsSync(file) ? read(file).videos : [];
            const hot = feed.videos.filter(v => v.channelId === channel.id);
            const all = [...new Map([...archive, ...hot].map(v => [v.id, v])).values()];
            assert(all.length > 0, 'Sense gravacions publicades');
            assert(all.every(v => channel.allowedVideoIds.includes(v.id) && !hidden.has(v.id)), 'Vídeo no seleccionat al catàleg');
            for (const v of all) {
                assert(['song','live_song'].includes(v.contentType), 'Tipus de contingut no musical');
                const title = cleanTitle(v.title, {artists:[v.channelTitle, artist.name, feed.channels[channel.id]?.name].filter(Boolean)});
                assert(title.trim(), 'Títol buit');
                assert(!/[([{][^()[\]{}]*(video|vídeo|oficial|official)[^()[\]{}]*[)\]}]/i.test(title), 'Marca promocional al títol: '+v.id);
            }
            assert(fs.existsSync('compartir/artista/'+channel.id+'.html'), 'Falta la pàgina compartida');
            channel.publication = {hot:hot.length, archive:archive.length, recordings:all.length,
                notPublished:channel.allowedVideoIds.filter(id => !all.some(v => v.id === id))};
            count += all.length;
        }
        artist.recordingsPublished = count; total += count;
    }
    if (fs.existsSync('/tmp/artur-borriana-channels-before.json')) {
        const before = read('/tmp/artur-borriana-channels-before.json').channels;
        assert(before.every(c => channels.some(x => x.id === c.id)), 'Ha desaparegut un canal anterior');
        report.preservedPublishedChannels = before.length;
    }
    assert(!channels.some(c => c.id === 'UC9zX7R05JQ1P30RGvtjHizQ'), 'No es pot reincorporar Teresa');
    report.publication = {checkedAt:new Date().toISOString(), artists:2, channels:5, recordings:total, status:'verified'};
    if (fs.existsSync('/tmp/tardor-blat-quinto-validation.json')) report.validation = read('/tmp/tardor-blat-quinto-validation.json');
    write(REPORT, report);
    const lines = ['# Alta d’Artur Àlvarez i Borriana Big Band', '', ...report.artists.map(a => '- '+a.name+' — '+a.place+' — '+a.genres.join(', ')+': '+a.recordingsPublished+' enregistraments.'), '',
        total+' enregistraments en cinc canals: tres Tema i dos oficials, agrupats en dos artistes. Les versions compten separadament.', '',
        ...report.artists.flatMap(a => ['## '+a.name, a.note, '']), report.method, '',
        report.validation ? 'Proves: '+report.validation.passedTests+' superades; '+report.validation.failedTests+' fallades preexistents; '+report.validation.regressions+' regressions.' : 'Validació completa pendent.', '',
        'Canals anteriors conservats: '+report.preservedPublishedChannels+'. Artistes aliens a l’alta sense canvis: '+report.preservedOtherArtists+'.'];
    fs.writeFileSync(SUMMARY, lines.join('\n')+'\n');
    console.log(JSON.stringify(report.publication));
}
function selfTest() {
    const [a,b] = CONFIG;
    const v = (id, channelId, album, title='Cançó') => ({id, channelId, title, description:'Provided to YouTube by Distribuïdor\n\nCançó · '+(channelId === b.primary ? b.name : a.name)+'\n\n'+album+'\n\n℗ Artista', duration:'PT3M', embeddable:true});
    assert.equal(reasonFor(a,{id:a.primary},v('W18tOiq66Po',a.primary,'ESTELLÉS a ritme de blues')),null);
    assert(reasonFor(a,{id:a.primary},v('CSQRgTs6y9s',a.primary,'10 POETES CONTEMPORANIS','Els poetes reciten')));
    assert(reasonFor(a,{id:a.primary},v('W18tOiq66Po',b.primary,'ESTELLÉS a ritme de blues')));
    assert(reasonFor(a,{id:a.primary},v('W18tOiq66Po',a.primary,'Disc desconegut')));
    assert(reasonFor(a,{id:a.official},v('tOvy7ilPSJY',a.official,'')));
    assert.equal(reasonFor(b,{id:b.official},v('pIluiaIVT6Q',b.official,'','Qualsevol nit pot sortir el sol')),null);
    assert(reasonFor(b,{id:b.official},v('BKr2ExIa83A',b.official,'','Vídeo promocional')));
    assert(reasonFor(b,{id:b.primary},{...v('SYQiwOsxt00',b.primary,'Peix Enamorat'),embeddable:false}));
    assert(reasonFor(b,{id:b.primary},{...v('SYQiwOsxt00',b.primary,'Peix Enamorat'),regionRestriction:{blocked:['ES']}}));
    assert.equal(seconds('PT1M33S'),93);
    assert.equal(new Set(CONFIG.flatMap(c => c.channels)).size,5);
    console.log('11 comprovacions específiques superades.');
}
if (require.main === module) (process.argv.includes('--verify') ? Promise.resolve().then(verify) : process.argv.includes('--self-test') ? Promise.resolve().then(selfTest) : apply()).catch(error => {console.error(error.stack);process.exitCode=1;});
module.exports = {CONFIG, REPORT, reasonFor, seconds, albumOf};
