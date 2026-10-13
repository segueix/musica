'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const SOURCE = 'https://ppf.cat/index.php/cat/artistes/obrint-pas';
const REPORT = 'docs/revisions/2026-10-13-obrint-pas-ska.json';
function repertoire(ids) {
    const videos = [...read('data/feed.json').videos];
    for (const id of ids) {
        const p = 'data/archive/channels/'+id+'.json';
        if (fs.existsSync(p)) videos.push(...read(p).videos);
    }
    return [...new Map(videos.filter(v => ids.includes(v.channelId)).map(v=>[v.id,v])).values()].sort((a,b)=>a.id.localeCompare(b.id));
}
if (!process.argv.includes('--verify')) {
    const db = read('data/artistes-musica.json');
    const artist = db.artists.find(a=>a.name==='Obrint Pas');
    assert(artist?.youtube?.channels?.length);
    const ids = artist.youtube.channels.map(c=>c.id), previous = repertoire(ids);
    assert(previous.length);
    write('/tmp/obrint-pas-before.json',{otherArtists:db.artists.filter(a=>a.name!=='Obrint Pas'),
        songs:previous.map(v=>({id:v.id,title:v.title,channelId:v.channelId})),ids});
    artist.genres = ['Ska / Reggae'];
    artist.sources = [...new Set([...artist.sources,SOURCE,'genre:manual'])];
    const reviews = read('data/music-affinity-review.json');
    reviews.artists = reviews.artists.filter(a=>a.artist!=='Obrint Pas');
    reviews.artists.push({artist:'Obrint Pas',genres:['Ska / Reggae'],facets:['ska','punk','hardcore','reggae','folk'],
        sources:[SOURCE],reviewedAt:'2026-10-13',confidence:0.9,method:'source-review'});
    const taxonomy = read('data/music-subcategories.json');
    taxonomy.overrides['Obrint Pas'] = {subcategory:'ska-punk',
        basis:'Categoria Ska / Reggae indicada per l’usuari. Subestil únic Ska-punk per la fusió de ska i hardcore amb música tradicional valenciana documentada pel segell.',
        sources:[SOURCE]};
    write('data/artistes-musica.json',db);
    write('data/music-affinity-review.json',reviews);
    write('data/music-subcategories.json',taxonomy);
} else {
    const before = read('/tmp/obrint-pas-before.json');
    assert.deepEqual(read('data/artistes-musica.json').artists.filter(a=>a.name!=='Obrint Pas'),before.otherArtists);
    const songs = repertoire(before.ids);
    assert.deepEqual(songs.map(v=>({id:v.id,title:v.title,channelId:v.channelId})),before.songs);
    assert(songs.every(v=>JSON.stringify(v.categories)===JSON.stringify(['Ska / Reggae'])));
    for (const c of read('js/channels-ca.json').channels.filter(c=>before.ids.includes(c.id))) assert.deepEqual(c.categories,['Ska / Reggae']);
    const sandbox={window:{}};
    vm.runInNewContext(fs.readFileSync('js/features/music-affinity-catalog.js','utf8'),sandbox);
    const p=sandbox.window.SegueixMusicAffinityCatalog.profiles.find(p=>p.artist==='Obrint Pas');
    assert(p && p.primaryCategory==='Ska / Reggae' && p.subcategory==='ska-punk');
    assert.equal(JSON.stringify(p.categories),JSON.stringify(['Ska / Reggae']));
    const result={artist:'Obrint Pas',category:'Ska / Reggae',subcategory:'Ska-punk',removedCategory:'Rock',
        channels:before.ids,recordings:songs.length,preservedRepertoire:true,preservedOtherArtists:true,
        sources:[SOURCE],verifiedAt:new Date().toISOString()};
    write(REPORT,result); console.log(JSON.stringify(result));
}
