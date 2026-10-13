'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const digest = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const NAME = "Pirat's Sound Sistema", ID = 'UC8r4joFv4Q0LczFyYvW7Lsg';
const REPORT = 'docs/revisions/2026-10-13-pirats-txarango-alta.json';
const SOURCE = 'https://ppf.cat/index.php/cat/artistes/pirat-s-sound-sistema';
const TXSOURCE = 'https://www.llull.cat/catala/recursos/musica_cb_mestissatge.cfm';
const PENDING = ['FfWUm-xvZPo', 'VKPxPUq-OJ8', 'O5vO7E46CiI', 'DRIWah5DiyQ'];
const uniq = a => [...new Set(a)];
function apply() {
    const db = read('data/artistes-musica.json');
    const p = db.artists.find(a => a.name === NAME), t = db.artists.find(a => a.name === 'Txarango');
    assert(p && t && p.reviewStatus !== 'rebutjat');
    const snapshot = read('docs/revisions/2026-10-13-pirats-descoberta.json').artists[0].channels.find(c => c.id === ID);
    assert(snapshot?.complete && snapshot.videos.length === 69);
    assert(!db.artists.some(a => a !== p && a.youtube?.channels?.some(c => c.id === ID)));
    assert(p.youtube.channels.every(c => c.id === ID));
    const otherArtists = db.artists.filter(a => ![NAME, 'Txarango'].includes(a.name));
    const oldFeed = read('data/feed.json');
    const txIds = t.youtube.channels.map(c => c.id);
    const hidden = new Set(read('data/hidden-videos.json').videoIds);
    const language = read('data/revisio-idiomes.json');
    const allowed = snapshot.videos.filter(v => !PENDING.includes(v.id) && !hidden.has(v.id)
        && !(language.decisions || []).some(d => d.id === v.id && d.accio === 'amaga')
        && v.embeddable && !v.regionRestriction?.blocked?.includes('ES')
        && (!v.regionRestriction?.allowed || v.regionRestriction.allowed.includes('ES'))).map(v => v.id);
    assert.equal(allowed.length, 65);
    Object.assign(p, {genres:['Ska / Reggae'], territories:['Catalunya'], languages:['ca'],
        confidence:'alta', reviewStatus:'aprovat', active:true, lastChecked:'2026-10-13',
        sources:uniq([...p.sources, SOURCE, 'genre:manual']),
        notes:'Alta del canal Tema indicat per l’usuari. Barcelona (Sants). Reggae / Dancehall. Selecció editorial amb quatre pistes pendents de contrast lingüístic; no s’afirma verificació íntegra de totes les lletres.'});
    p.youtube.channels = [{id:ID, name:snapshot.name, handle:snapshot.handle, type:'topic', primary:true}];
    t.genres = ['Rumba / Mestissatge'];
    t.sources = uniq([...t.sources, TXSOURCE, 'genre:manual']);
    const taxonomy = read('data/music-subcategories.json');
    taxonomy.overrides[NAME] = {subcategory:'reggae', basis:'Reggae, ragga i dancehall segons el segell. Categoria Ska / Reggae indicada per l’usuari.', sources:[SOURCE]};
    taxonomy.overrides.Txarango = {subcategory:'mestissatge', basis:'Fusió de ritmes jamaicans i llatins. Trasllat de Ska a Mestissatge indicat per l’usuari.', sources:[TXSOURCE]};
    const reviews = read('data/music-affinity-review.json');
    for (const [artist,genres,facets,source] of [[NAME,p.genres,['reggae','dancehall'],SOURCE],['Txarango',t.genres,['mestissatge','reggae'],TXSOURCE]]) {
        reviews.artists = reviews.artists.filter(a => a.artist !== artist);
        reviews.artists.push({artist,genres,facets,sources:[source],reviewedAt:'2026-10-13',confidence:0.9,method:'source-review'});
    }
    const origins = read('data/origens-artistes.json'), key = 'artist:pirat-s-sound-sistema';
    assert(origins.places['geonames:3128760'].name === 'Barcelona');
    origins.artists[key] = {...origins.artists[key], name:NAME, status:'validated', relation:'origin',
        placeIds:['geonames:3128760'], confidence:'alta', basis:'Origen a Sants, Barcelona; municipi indicat per l’usuari i documentat pel segell.',
        sources:[SOURCE], reviewedOn:'2026-10-13', assignmentSource:'manual-review', locked:true};
    origins.channels[ID] = key;
    const allow = read('data/music-channel-video-allowlist.json');
    allow.channels[ID] = {artist:NAME, allowedVideoIds:allowed, acceptedMusicOnly:true, allowedContentTypes:['song'],
        note:'Selecció editorial acotada al canal Tema. Quatre pistes pendents de contrast de llengua; les novetats requereixen revisió. '+REPORT};
    const names = read('data/noms-canals.json'); names.overrides[ID] = NAME;
    const watch = read('data/artistes-vigilats-idioma.json');
    watch.confianca = watch.confianca.filter(a => (typeof a === 'string' ? a : a.artista) !== NAME);
    watch.vigilats = watch.vigilats.filter(a => a.artista !== NAME);
    watch.vigilats.push({artista:NAME, aliases:[snapshot.name], canals:[ID], motiu:'Revisió de novetats i de quatre pistes pendents de contrast lingüístic. Selecció actual per llista blanca.', fonts:[SOURCE,REPORT]});
    language.decisions ||= [];
    for (const id of allowed) if (!language.decisions.some(d => d.id === id)) language.decisions.push({id,accio:'conserva',artista:NAME,
        titol:snapshot.videos.find(v => v.id === id).title,font:SOURCE,origen:REPORT,data:new Date().toISOString(),
        criteri:'seleccio-editorial',lletraIntegraVerificada:false});
    language.pendents = (language.pendents || []).filter(v => !allowed.includes(v.id));
    for (const id of PENDING) if (!language.pendents.some(v => v.id === id)) {
        const v = snapshot.videos.find(v => v.id === id);
        language.pendents.push({id,artista:NAME,canalId:ID,titol:v.title,tipus:'song',publicada:v.publishedAt.slice(0,10),
            afegida:new Date().toISOString(),descripcio:'Pendent de contrast de la llengua de tota la peça; no s’infereix l’idioma només del títol o dels col·laboradors. '+REPORT});
    }
    const result = {artist:NAME,channelId:ID,category:'Ska / Reggae',subcategory:'reggae',place:'Barcelona',
        selected:allowed.length,allowedVideoIds:allowed,pending:PENDING.map(id => ({id,title:snapshot.videos.find(v => v.id === id).title})),
        txarango:{channelIds:txIds,category:'Rumba / Mestissatge',subcategory:'mestissatge'},
        otherArtistsHash:digest(otherArtists),previousOtherVideoIds:oldFeed.videos.filter(v => !txIds.includes(v.channelId)).map(v => v.id),
        method:'Identitat i discografia contrastades amb el canal Tema i el segell. Acceptació editorial; no equival a verificació íntegra de totes les lletres.'};
    for (const [path,value] of [['artistes-musica',db],['music-subcategories',taxonomy],['music-affinity-review',reviews],
        ['origens-artistes',origins],['music-channel-video-allowlist',allow],['noms-canals',names],['artistes-vigilats-idioma',watch],['revisio-idiomes',language]]) write('data/'+path+'.json',value);
    write(REPORT,result);
}
function verify() {
    const result = read(REPORT), db = read('data/artistes-musica.json'), feed = read('data/feed.json');
    assert.equal(digest(db.artists.filter(a => ![NAME,'Txarango'].includes(a.name))),result.otherArtistsHash);
    const channels = read('js/channels-ca.json').channels;
    assert.deepEqual(channels.find(c => c.id === ID).categories,['Ska / Reggae']);
    for (const id of result.txarango.channelIds) assert.deepEqual(channels.find(c => c.id === id).categories,['Rumba / Mestissatge']);
    const all = [...feed.videos];
    for (const file of fs.readdirSync('data/archive/channels').filter(f => f.endsWith('.json'))) all.push(...read('data/archive/channels/'+file).videos);
    const ids = new Set(all.map(v => v.id));
    assert(result.previousOtherVideoIds.every(id => ids.has(id)),'Repertori aliè perdut');
    const pirats = [...new Map(all.filter(v => v.channelId === ID).map(v => [v.id,v])).values()];
    assert(pirats.length > 0 && pirats.every(v => result.allowedVideoIds.includes(v.id)));
    assert(pirats.every(v => v.categories.includes('Ska / Reggae')));
    const tx = all.filter(v => result.txarango.channelIds.includes(v.channelId));
    assert(tx.length && tx.every(v => v.categories.includes('Rumba / Mestissatge') && !v.categories.includes('Ska / Reggae')));
    const sandbox = {window:{}};
    vm.runInNewContext(fs.readFileSync('js/features/music-affinity-catalog.js','utf8'),sandbox);
    const profiles = sandbox.window.SegueixMusicAffinityCatalog.profiles;
    for (const [name,category,subcategory] of [[NAME,'Ska / Reggae','reggae'],['Txarango','Rumba / Mestissatge','mestissatge']]) {
        const p = profiles.find(p => p.artist === name);
        assert(p && p.primaryCategory === category && p.subcategory === subcategory);
        assert.equal(JSON.stringify(p.categories),JSON.stringify([category]));
    }
    assert(fs.existsSync('compartir/artista/'+ID+'.html'));
    result.publication = {checkedAt:new Date().toISOString(),publishedRecordings:pirats.length,txarangoRecordings:tx.length,status:'verified'};
    delete result.previousOtherVideoIds;
    write(REPORT,result); console.log(JSON.stringify(result.publication));
}
if (process.argv.includes('--verify')) verify(); else apply();
