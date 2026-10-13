'use strict';

// Alta editorial acotada als tres artistes demanats el 13-10-2026.
// La selecció documental no equival a una escolta ni a una verificació integral de cada lletra.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);
const REPORT = 'docs/revisions/2026-10-13-castello-alta.json';
const SUMMARY = 'docs/revisions/2026-10-13-castello-alta.md';
const DISCOVERY = 'docs/revisions/2026-10-13-castello-descoberta.json';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, j) => fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
const norm = v => String(v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = a => [...new Set(a)];
const ids = s => s.trim().split(/\s+/).filter(Boolean);
const CONFIG = [
    {
        name: 'Malparlat', aliases: ['MALPARLAT', 'Alfons Pérez Daràs'], key: 'artist:malparlat',
        genres: ['Rap / Hip-hop'], place: 'Nules', placeAliases: ['Nules'], relation: 'origin',
        primary: 'UCYZ_QLkQxtK8uif-J2Nxmig', official: 'UCVmppHKiBolLy_N0uKkbWfA',
        channels: ['UCYZ_QLkQxtK8uif-J2Nxmig', 'UCVmppHKiBolLy_N0uKkbWfA'],
        officialIds: ids('WAgo9paQZ8M AfhBzkHVAWg WP08ct1SgZE Z--_tLryeUo OGioJA_Rkuw N0vlG9NQkYI duh9xZjdx1Y JxqHTBR-lx8 mL3bA4OD5-w'),
        pendingIds: ids('OSrMHTreCfc qgD4vktStsM OI9B97mEA7k uUdK1xi6A_Q gRQT-p0Gvlc bFltlLiuhbw'),
        sources: [
            'https://revistamirall.com/2022/06/21/entrevista-amb-malparlat/',
            'https://ivc.gva.es/val/audiovisual/malparlat-v',
            'https://escolavalenciana.bandcamp.com/track/taronja',
            'https://escolavalenciana.bandcamp.com/track/somnis',
            'https://www.elritmodelacalle.com/malparlat-sin-pelos-en-la-lengua/',
            'https://www.enderrock.cat/barcelonasound/disc/9510/sentimantral'
        ],
        basis: 'L’entrevista directa situa Alfons Pérez Daràs a Nules. El seu canal també identifica Nules com el seu poble.',
        note: 'Projecte Malparlat: selecció documental en català. Fora els vídeos divulgatius, tallers, promocions i instrumentals duplicats; sis pistes requereixen contrast addicional de llengua. L’etapa El Blüe no es dona per revisada en aquesta alta.'
    },
    {
        name: 'Xiomara Abello', aliases: ['Xiomara Abelló'], key: 'artist:xiomara-abello',
        genres: ["Cançó d'autor", 'Folk i arrel'], place: 'Santa Magdalena de Polpís',
        placeAliases: ['Santa Magdalena de Polpís', 'Santa Magdalena de Pulpis'], relation: 'associated',
        primary: 'UCNwoEDBqOp6F_HmTvp7cjvw', official: 'UCvKDCx209GA2OXyoWG449WA',
        channels: ['UCNwoEDBqOp6F_HmTvp7cjvw', 'UCdNEdTr3yqzc6eYUMt6I3KA', 'UCvKDCx209GA2OXyoWG449WA'],
        officialIds: ids('B0GedhS3zzQ NIIMsDNNNLU S7XFLel8BfE 6ZoN_Uu0uCs QkPN0hRHYbo HqiiLJ8OaIg'),
        topicIds: {
            UCNwoEDBqOp6F_HmTvp7cjvw: ids('x_yRv3w6gqs RycTQsLX8Jg eaOJRj4OrC0 o3-M0ZEOagk 0niVsLxSDNU 3t9glRDYxQQ KQdR2-Et9q8 -o1RLtATx4k 4vUpsSTO2fY A6bzi2X2k3U'),
            UCdNEdTr3yqzc6eYUMt6I3KA: ids('ymo4oItxods EZ2ppa6IBe4 LmpYR8pCCrA')
        },
        liveIds: ids('NIIMsDNNNLU HqiiLJ8OaIg'),
        sources: [
            'https://www.santamagdalena.es/es/la-cantautora-xiomara-abello-presenta-disco-teles/',
            'https://musicaenvalencia.es/artista/117/xiomara-abello',
            'https://www.enderrock.cat/edrvalencia/numero10/disc/7696',
            'https://escolavalenciana.bandcamp.com/track/morisc-passat',
            'https://escolavalenciana.bandcamp.com/track/xiomara-abello-ideal',
            'https://xiomaraabello.bandcamp.com/album/flor-de-xicoia'
        ],
        basis: 'L’Ajuntament acredita les arrels magdaleneres. S’indica vinculació, no s’atribueix un lloc de naixement a partir de les arrels familiars.',
        note: 'Repertori multilingüe: selecció documental limitada als IDs indicats. Ideal i Morisc passat tenen lletra publicada contrastada. No es considera revisada tota la discografia ni es dedueix la llengua només del títol. Les altres pistes i col·laboracions romanen fora de la selecció fins al contrast.'
    },
    {
        name: 'Esther', aliases: ['ESTHER', 'Esther Querol', 'Esther Querol Forner'], key: 'artist:esther-querol-forner',
        genres: ['Pop', 'Rock'], place: 'Vinaròs', placeAliases: ['Vinaròs', 'Vinaros'], relation: 'origin',
        primary: 'UCouw5jG-XQKAuUA4FHGDwGw', official: 'UCrJr-rEu-grrBNj0TfWUEmA',
        channels: ['UCouw5jG-XQKAuUA4FHGDwGw', 'UCS52L7FhuL9P1ZvXxDJwv4g', 'UCrJr-rEu-grrBNj0TfWUEmA'],
        officialIds: ids('oIJBi4dBwJk K1nzUA5YP7c yC53MwBG-kM _i_4D2MwN_w oTC44qcp4UM btSUYWiIsWs a4hdzAgEv6g JREp-eKvCkU 9QqlApb0Rtw CzLzNpio16s dQf2uO_0Xf4 9EY1sqpDwqo E0uNpUDg6nI kNowAo1w460 Jg7JKmjckGI'),
        sources: [
            'https://www.diarilaveu.cat/cultura/esther-sobre-el-nou-disc-crec-que-es-emocional-autentic-i-caotic-585090/',
            'https://www.valencianmusicoffice.com/artist/ec810b9f-fd21-4b3a-ad2d-8789fcbf898c',
            'https://www.enderrock.cat/noticia/25374/esther-soc-nena-trista-pero-done-llum-esperanca-amb-cancons',
            'https://www.youtube.com/watch?v=oIJBi4dBwJk'
        ],
        basis: 'Esther Querol Forner, de Vinaròs: es reutilitza la identitat existent i els crèdits de les edicions oficials, sense crear un homònim.',
        note: 'Dos canals Tema de la mateixa Esther Querol Forner, agrupats amb el canal oficial. Fora Wish You Were Here, resums, promocions i trobades. Selecció documental dels discos en català i de la versió Si tanque els ulls.'
    }
];
const LYRIC_SOURCES = {
    PbEFX0zHHww: 'https://escolavalenciana.bandcamp.com/track/taronja',
    IchaQqDV3LY: 'https://escolavalenciana.bandcamp.com/track/taronja',
    'mL3bA4OD5-w': 'https://escolavalenciana.bandcamp.com/track/taronja'
};
// Claus amb guions necessiten literals explícits.
Object.assign(LYRIC_SOURCES, {
    'AfhBzkHVAWg': 'https://www.youtube.com/watch?v=AfhBzkHVAWg',
    'HjnUlQ3vvGw': 'https://www.youtube.com/watch?v=AfhBzkHVAWg',
    'iE5iMufoPWQ': 'https://escolavalenciana.bandcamp.com/track/somnis',
    'ymo4oItxods': 'https://escolavalenciana.bandcamp.com/track/morisc-passat',
    '6ZoN_Uu0uCs': 'https://escolavalenciana.bandcamp.com/track/morisc-passat',
    '-o1RLtATx4k': 'https://escolavalenciana.bandcamp.com/track/xiomara-abello-ideal',
    'QkPN0hRHYbo': 'https://escolavalenciana.bandcamp.com/track/xiomara-abello-ideal',
    'oIJBi4dBwJk': 'https://www.youtube.com/watch?v=oIJBi4dBwJk'
});
function seconds(value) {
    const m = String(value).match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    return m ? + (m[1] || 0) * 86400 + + (m[2] || 0) * 3600 + + (m[3] || 0) * 60 + + (m[4] || 0) : 0;
}
function reasonFor(config, channel, video) {
    if (video.channelId !== channel.id || !/^[A-Za-z0-9_-]{11}$/.test(video.id)) return 'Editor o identificador no coincident.';
    if (!video.embeddable || video.regionRestriction?.blocked?.includes('ES') ||
        (video.regionRestriction?.allowed && !video.regionRestriction.allowed.includes('ES'))) return 'No reproduïble per inserció a Espanya.';
    if (!seconds(video.duration) || seconds(video.duration) > 900) return 'Durada no corresponent a una cançó individual seleccionada.';
    if (video.id === 'nZ4VM3DFEDI') return 'Versió en anglès de Wish You Were Here.';
    if (channel.id === config.official && !config.officialIds.includes(video.id)) return 'Vídeo no seleccionat: promoció, divulgació, etapa anterior o llengua/contingut pendent de contrast.';
    if (channel.id !== config.official) {
        if (config.pendingIds?.includes(video.id)) return 'Llengua pendent de contrast addicional; no s’afirma que sigui en una altra llengua.';
        if (config.topicIds && !config.topicIds[channel.id]?.includes(video.id)) return 'Pista fora de la selecció catalana documentada; pendent de contrast individual.';
        if (config.name === 'Malparlat' && /\(instrumental\)/i.test(video.title)) return 'Base instrumental alternativa a la versió vocal ja considerada.';
        if (!/^provided to youtube/i.test(video.description || '')) return 'No s’acredita l’edició distribuïda del Tema.';
    }
    return null;
}
async function placeFor(config, origins) {
    const matches = Object.entries(origins.places).filter(([, p]) => p.type === 'municipality' && config.placeAliases.map(norm).includes(norm(p.name)));
    if (matches.length) return matches[0][0];
    for (const name of config.placeAliases) {
        const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
        Object.entries({name,count:10,language:'ca',format:'json',countryCode:'ES'}).forEach(([k,v]) => u.searchParams.set(k,v));
        const r = await fetch(u, {signal:AbortSignal.timeout(30000)});
        if (!r.ok) throw Error('No es pot geocodificar '+config.place);
        const j = await r.json();
        const p = j.results?.find(p => config.placeAliases.map(norm).includes(norm(p.name)) && p.country_code === 'ES' && /^PPL/.test(p.feature_code));
        if (!p) continue;
        assert(p.latitude > 39 && p.latitude < 41 && p.longitude > -1 && p.longitude < 1, 'Coordenades fora de Castelló');
        const key = 'geonames:'+p.id;
        assert(!origins.places[key], 'Cal reconciliar un lloc existent');
        origins.places[key] = {name:config.place,type:'municipality',geonamesId:p.id,
            coordinates:{latitude:p.latitude,longitude:p.longitude,precision:'settlement_reference'},
            territory:'País Valencià',source:u.href,checkedOn:'2026-10-13'};
        return key;
    }
    throw Error('No es resol el municipi '+config.place);
}
async function apply() {
    const snapshot = read(DISCOVERY), now = new Date().toISOString();
    const base = read('data/artistes-musica.json'), origins = read('data/origens-artistes.json');
    const allow = read('data/music-channel-video-allowlist.json'), watch = read('data/artistes-vigilats-idioma.json');
    const types = read('data/music-content-overrides.json'), names = read('data/noms-canals.json');
    const language = read('data/revisio-idiomes.json'), shorts = read('data/falsos-shorts.json');
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    const allNames = new Set(CONFIG.flatMap(c => [c.name,...c.aliases]).map(norm));
    const matchesName = a => [a.name,a.displayName,...(a.aliases || [])].some(n => allNames.has(norm(n)));
    const unchanged = base.artists.filter(a => !matchesName(a)).map(a => JSON.stringify(a));
    const report = {schemaVersion:1,reviewedOn:'2026-10-13',generatedAt:now,
        method:'Selecció documental de repertori; identitat pels canals, crèdits i edicions. No s’ha fet escolta íntegra ni verificació integral de totes les lletres. Les comprovacions de lletra completa s’identifiquen separadament. Llistes tancades per ID.',artists:[]};
    for (const config of CONFIG) {
        const found = snapshot.artists.find(a => a.name === config.name);
        assert(found, 'Manca la consulta de '+config.name);
        const channels = config.channels.map(id => {
            const c = found.channels.find(c => c.id === id);
            assert(c?.complete, 'Consulta incompleta de '+id); return c;
        });
        const relevantNames = new Set([config.name,...config.aliases].map(norm));
        const matches = base.artists.filter(a => [a.name,a.displayName,...(a.aliases || [])].some(n => relevantNames.has(norm(n))));
        assert(matches.length <= 1, 'Identitat duplicada: '+config.name);
        const artist = matches[0] || {wikidataId:null,musicbrainzId:null,aliases:[],sources:[],youtube:{channels:[]}};
        assert(!(artist.youtube?.channels || []).some(c => !config.channels.includes(c.id)), 'Cal preservar/reconciliar canals anteriors de '+config.name);
        assert(artist.reviewStatus !== 'rebutjat', 'Existeix una baixa expressa que cal contrastar: '+config.name);
        const originMatches = Object.entries(origins.artists).filter(([,a]) => relevantNames.has(norm(a.name)));
        assert(originMatches.length <= 1, 'Orígens duplicats de '+config.name);
        const originKey = originMatches[0]?.[0] || config.key;
        const placeId = await placeFor(config, origins);
        const canonicalName = matches[0]?.name || config.name;
        Object.assign(artist,{name:canonicalName,displayName:config.name,aliases:unique([...(artist.aliases || []),...config.aliases,config.name]),
            genres:config.genres,territories:['País Valencià'],languages:['català'],
            sources:unique([...(artist.sources || []),...config.sources]),confidence:'alta',reviewStatus:'aprovat',active:true,lastChecked:'2026-10-13',notes:config.note+' '+REPORT});
        artist.youtube = {...artist.youtube,channels:channels.map(c => ({id:c.id,handle:c.handle,name:c.name,type:c.id === config.official ? 'official' : 'topic',primary:c.id === config.primary}))};
        if (!matches.length) base.artists.push(artist);
        origins.artists[originKey] = {...origins.artists[originKey],name:config.name,status:'validated',relation:config.relation,placeIds:[placeId],confidence:'alta',basis:config.basis,sources:[config.sources[0]],reviewedOn:'2026-10-13',assignmentSource:'manual-review',locked:true};
        const entry = {name:config.name,canonicalName,place:config.place,relation:config.relation,genres:config.genres,sources:config.sources,note:config.note,channels:[],notSelected:[]};
        for (const channel of channels) {
            assert(!origins.channels[channel.id] || origins.channels[channel.id] === originKey,'Canal atribuït a una altra identitat');
            origins.channels[channel.id] = originKey;
            names.overrides[channel.id] = config.name;
            const selected = [];
            for (const v of channel.videos) {
                const reason = reasonFor(config,channel,v);
                if (reason) {entry.notSelected.push({id:v.id,title:v.title,channelId:channel.id,reason});continue;}
                assert(!hidden.has(v.id),'Vídeo prèviament ocult: '+v.id);
                selected.push(v);
                const contentType = config.liveIds?.includes(v.id) ? 'live_song' : 'song';
                const existingType = types.videos.findIndex(x => x.id === v.id);
                const decision = {id:v.id,contentType,title:v.title,note:'Gravació seleccionada; editor contrastat. '+REPORT};
                if (existingType < 0) types.videos.push(decision); else types.videos[existingType] = {...types.videos[existingType],...decision};
                const oldLanguage = (language.decisions || []).find(d => d.id === v.id);
                assert(oldLanguage?.accio !== 'amaga','Exclusió de llengua anterior: '+v.id);
                // No confonem confiança documental amb transcripció/escolta de la lletra completa.
                const keep = {id:v.id,accio:'conserva',artista:config.name,titol:v.title,
                    font:LYRIC_SOURCES[v.id] || config.sources[1],origen:REPORT,data:now,
                    criteri:LYRIC_SOURCES[v.id] ? 'lletra-publicada' : 'seleccio-documental',lletraIntegraVerificada:Boolean(LYRIC_SOURCES[v.id])};
                language.decisions ||= [];
                if (!oldLanguage) language.decisions.push(keep);
                if (channel.id !== config.official && seconds(v.duration) <= 120) shorts.falseShorts = unique([...(shorts.falseShorts || []),v.id]);
            }
            assert(selected.length,'Canal sense cançons seleccionades: '+channel.id);
            const allowedVideoIds = selected.map(v => v.id);
            allow.channels[channel.id] = {artist:config.name,note:config.note+' '+REPORT,allowedVideoIds,acceptedMusicOnly:true,allowedContentTypes:['song','live_song']};
            entry.channels.push({id:channel.id,type:channel.id === config.official ? 'official' : 'topic',primary:channel.id === config.primary,allowedVideoIds,selected:allowedVideoIds.length});
        }
        watch.vigilats = (watch.vigilats || []).filter(a => !relevantNames.has(norm(a.artista)));
        watch.vigilats.push({artista:config.name,aliases:unique([...config.aliases,canonicalName,...channels.map(c => c.name)]),canals:config.channels,motiu:config.note,fonts:config.sources});
        watch.confianca = (watch.confianca || []).filter(a => !relevantNames.has(norm(typeof a === 'string' ? a : a.artista)));
        report.artists.push(entry);
    }
    assert.deepEqual(base.artists.filter(a => !matchesName(a)).map(a => JSON.stringify(a)),unchanged,'No es poden modificar altres artistes');
    report.preservedOtherArtists = unchanged.length;
    for (const j of [base,origins,allow,types,language]) j.updatedAt=now;
    watch.updatedAt='2026-10-13';
    const files = {'data/artistes-musica.json':base,'data/origens-artistes.json':origins,'data/music-channel-video-allowlist.json':allow,
        'data/artistes-vigilats-idioma.json':watch,'data/music-content-overrides.json':types,'data/noms-canals.json':names,
        'data/revisio-idiomes.json':language,'data/falsos-shorts.json':shorts};
    for (const [f,j] of Object.entries(files)) write(f,j);
    write(REPORT,report);
    const targets=CONFIG.flatMap(c=>c.channels);
    assert.equal(new Set(targets).size,8,'Han de ser vuit canals diferents');
    if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,'MUSIC_TARGET_CHANNELS='+targets.join(',')+'\n');
    console.log(JSON.stringify(report.artists.map(a=>({name:a.name,selected:a.channels.reduce((n,c)=>n+c.selected,0),notSelected:a.notSelected.length}))));
}
function verify() {
    const report=read(REPORT),base=read('data/artistes-musica.json'),feed=read('data/feed.json');
    const channels=read('js/channels-ca.json').channels,origins=read('data/origens-artistes.json');
    const {cleanTitle}=require('../../js/song-title.js');
    let total=0;
    for(const artist of report.artists){
        const canonical=base.artists.filter(a=>a.name===artist.canonicalName&&a.active&&a.reviewStatus==='aprovat');
        assert.equal(canonical.length,1,'Una sola identitat activa: '+artist.name);
        assert.equal(canonical[0].youtube.channels.filter(c=>c.primary).length,1,'Un únic canal principal');
        let count=0;
        for(const channel of artist.channels){
            assert(channels.some(c=>c.id===channel.id),'Manca canal publicat');
            assert.equal(origins.artists[origins.channels[channel.id]].name,artist.name);
            const file='data/archive/channels/'+channel.id+'.json';
            const archive=fs.existsSync(file)?read(file).videos:[];
            const hot=feed.videos.filter(v=>v.channelId===channel.id);
            const all=[...new Map([...archive,...hot].map(v=>[v.id,v])).values()];
            assert(all.length>0,'Canal sense gravacions: '+channel.id);
            assert(all.every(v=>channel.allowedVideoIds.includes(v.id)),'Ha entrat una gravació fora de selecció');
            for(const v of all){
                const title=cleanTitle(v.title,{artists:[v.channelTitle,artist.name,feed.channels[channel.id]?.name].filter(Boolean)});
                assert(title.trim(),'Títol buit de '+v.id);
                assert(!/[([{][^()[\]{}]*(video|vídeo|oficial|official)[^()[\]{}]*[)\]}]/i.test(title),'Marca promocional: '+v.id+' '+title);
            }
            assert(fs.existsSync('compartir/artista/'+channel.id+'.html'),'Manca pàgina compartida');
            channel.publication={hot:hot.length,archive:archive.length,recordings:all.length};
            count+=all.length;
        }
        artist.recordingsPublished=count;total+=count;
    }
    if(fs.existsSync('/tmp/castello-channels-before.json')){
        const before=read('/tmp/castello-channels-before.json').channels;
        assert(before.every(c=>channels.some(x=>x.id===c.id)),'Ha desaparegut un canal anterior');
        report.preservedPublishedChannels=before.length;
    }
    assert(!channels.some(c=>c.id==='UC9zX7R05JQ1P30RGvtjHizQ'),'No es pot reincorporar Teresa Sanna');
    report.publication={checkedAt:new Date().toISOString(),artists:3,channels:8,recordings:total,status:'verified'};
    if(fs.existsSync('/tmp/tardor-blat-quinto-validation.json'))report.validation=read('/tmp/tardor-blat-quinto-validation.json');
    write(REPORT,report);
    fs.writeFileSync(SUMMARY,'# Alta de Malparlat, Xiomara Abello i Esther\n\n'+report.artists.map(a=>'- '+a.name+' — '+a.place+(a.relation==='associated'?' (vinculació)':'')+' — '+a.genres.join(', ')+': '+a.recordingsPublished+' enregistraments.').join('\n')+'\n\n'+total+' enregistraments; vuit canals, amb un Tema principal per artista. El recompte inclou versions diferents, no només composicions úniques.\n\n'+report.artists.map(a=>'## '+a.name+'\n'+a.note).join('\n\n')+'\n\n'+report.method+'\n\nProves: '+(report.validation?report.validation.passedTests+' superades; '+report.validation.failedTests+' fallades preexistents; '+report.validation.regressions+' regressions.':'pendent del resum de validació.')+'\n');
    console.log(JSON.stringify(report.publication));
}
if(require.main===module)(process.argv.includes('--verify')?Promise.resolve().then(verify):apply()).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={CONFIG,reasonFor,seconds,REPORT};
