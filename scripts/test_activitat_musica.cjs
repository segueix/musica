'use strict';

// Proves del generador real en directoris temporals, amb totes les respostes de
// YouTube simulades. Cap API, clau real, workflow ni dada del repositori es modifica.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const polling = require('./lib/activitat-canals-musica');
const ROOT = path.resolve(__dirname, '..');
const NOW = '2026-10-14T18:00:00.000Z';
const now = new Date(NOW);
const channel = n => 'UC' + String(n).padStart(22, 'a');
const video = n => String(n).padStart(11, 'v');

test('llindars d’un i tres anys, sense buit entre dos i tres', () => {
    for (const [date, days] of [
        ['2026-10-01', 1], ['2025-10-15', 1], ['2025-10-14', 3], ['2024-01-01', 3],
        ['2023-10-14', 3], ['2023-10-13', 7], [null, 1], ['invalid', 1], ['2027-01-01', 1],
    ]) assert.equal(polling.intervalDays(date, now), days, String(date));
    assert.equal(polling.intervalDays('2023-02-28', new Date('2024-02-29T12:00:00Z')), 3);
});

test('dies locals, canvi d’hora, torns vençuts i dades invàlides', () => {
    assert.equal(polling.dateKey(new Date('2026-10-14T22:30:00Z')), '2026-10-15');
    const state = { channels: {} };
    polling.recordSuccess(state, channel(1), { latestPublishedAt: '2020-01-01' }, new Date('2026-10-24T18:00:00Z'));
    assert.equal(state.channels[channel(1)].nextCheckOn, '2026-10-31');
    assert.equal(polling.isDue(state.channels[channel(1)], new Date('2026-10-30T22:00:00Z')), false);
    assert.equal(polling.isDue(state.channels[channel(1)], new Date('2026-11-03T19:00:00Z')), true);
    assert.equal(polling.isDue({ lastCheckedAt: NOW, nextCheckOn: '2026-02-31' }, now), true);
    assert.equal(polling.isDue(null, now), true);
});

test('activitat pública abans dels filtres, mai data d’inserció a la llista ni any del disc', () => {
    const item = (date, privacyStatus = 'public') => ({ contentDetails: { videoPublishedAt: date }, status: { privacyStatus } });
    assert.equal(polling.latestPublication([
        item('2020-01-01'), item('2026-10-01'), item('2026-10-12', 'private'), item('2027-01-01'),
        { snippet: { publishedAt: '2026-10-13' }, originalYear: 1980 },
    ], now), '2026-10-01T00:00:00.000Z');
    assert.equal(polling.latestPublication([], now), null);
});

function fixture(t, specs) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'musica-poll-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'js'));
    fs.mkdirSync(path.join(dir, 'data'));
    fs.cpSync(path.join(ROOT, 'scripts/lib'), path.join(dir, 'scripts/lib'), { recursive: true });
    for (const file of ['scripts/update_music_feed.js', 'scripts/ocultar_titols_castella.js', 'js/song-title.js']) {
        fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
    }
    const write = (file, data) => fs.writeFileSync(path.join(dir, file), JSON.stringify(data));
    const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const channels = {}, videos = [], state = { version: 1, channels: {} }, artists = [], index = [];
    for (const spec of specs) {
        const id = channel(spec.n), name = 'Grup ' + spec.n;
        artists.push({ name, genres: ['Pop'], youtube: { channels: [{ id, type: spec.type || 'official' }] } });
        if (!spec.new) {
            channels[id] = { name, categories: ['Pop'], artists: [name] };
            index.push({ id, ...channels[id] });
            for (let i = 0; i < (spec.count || 1); i++) videos.push({
                id: video(spec.n * 1000 + i), channelId: id, channelTitle: name,
                title: 'Cançó ' + i, publishedAt: spec.latest || '2020-01-01T00:00:00Z',
                durationSeconds: 180, contentType: 'song', categories: ['Pop'], viewCount: 123,
            });
        }
        if (spec.checked) polling.recordSuccess(state, id, { latestPublishedAt: spec.latest, fullTopic: spec.fullTopic }, new Date(spec.checked));
    }
    write('data/artistes-musica.json', { artists });
    write('data/artistes-vigilats-idioma.json', { schemaVersion: 1, vigilats: [], confianca: [] });
    write('data/feed.json', { channels, videos });
    write('js/channels-ca.json', { channels: index });
    write('data/music-channel-polling.json', state);
    write('data/music-content-review.json', { videos: [] });
    const run = (options = {}) => {
        fs.rmSync(path.join(dir, 'calls.json'), { force: true });
        write('mock.json', { now: NOW, specs, ...options });
        const bootstrap = `
            const fs=require('node:fs');
            const mock=JSON.parse(fs.readFileSync('mock.json','utf8'));
            const RealDate=Date;
            global.Date=class extends RealDate { constructor(...args){super(...(args.length?args:[mock.now]));} static now(){return new RealDate(mock.now).getTime();} };
            const channel=n=>'UC'+String(n).padStart(22,'a'), video=n=>String(n).padStart(11,'v');
            const calls=[];
            global.fetch=async input=>{
                const url=new URL(input), resource=url.pathname.split('/').pop(), params=Object.fromEntries(url.searchParams);
                delete params.key; calls.push({resource,params});fs.writeFileSync('calls.json',JSON.stringify(calls));
                const spec=mock.specs.find(s=>params.playlistId==='uploads-'+channel(s.n));
                if(mock.fail===resource || (spec && mock.failChannel===spec.n)) return {ok:false,status:503,text:async()=> 'offline'};
                let items=[];
                if(resource==='channels') items=params.id.split(',').filter(id=>id!==mock.unresolved).map(id=>({id,snippet:{title:'Grup '+mock.specs.find(s=>channel(s.n)===id).n},contentDetails:{relatedPlaylists:{uploads:'uploads-'+id}}}));
                else if(resource==='playlistItems') {
                    if(!spec) throw Error('Llista inesperada');
                    items=spec.empty?[]:[{contentDetails:{videoId:spec.freshId||video(spec.n*1000),videoPublishedAt:spec.rawDate||spec.latest},snippet:{title:'Cançó (Official Audio)'},status:{privacyStatus:'public'}}];
                } else if(resource==='videos') items=params.id.split(',').map(id=>{
                    const spec=mock.specs.find(s=>s.freshId===id || video(s.n*1000)===id || Number(id.replace(/^v+/,''))>=s.n*1000 && Number(id.replace(/^v+/,''))<s.n*1000+(s.count||1));
                    if(!spec) throw Error('Vídeo inesperat '+id);
                    return {id,snippet:{title:'Cançó (Official Audio)',channelId:channel(spec.n),publishedAt:spec.rawDate||spec.latest||'2020-01-01T00:00:00Z'},contentDetails:{duration:'PT3M'},status:{privacyStatus:'public',embeddable:true},statistics:{viewCount:'200'}};
                });
                else throw Error('Consulta inesperada '+resource);
                return {ok:true,json:async()=>({items})};
            };
            require('./scripts/update_music_feed.js');
        `;
        const result = spawnSync(process.execPath, ['-e', bootstrap], { cwd: dir, encoding: 'utf8',
            env: { ...process.env, YOUTUBE_API_KEY_SERVER: 'test-only', MUSIC_TARGET_CHANNELS: options.targets || '',
                MUSIC_TOPIC_FULL_READ: options.forceTopic ? '1' : '0', MUSIC_DEEP_PAGE_BUDGET: '0' }, timeout: 15000 });
        if (!options.expectFailure) assert.equal(result.status, 0, result.stdout + result.stderr);
        return { result, calls: fs.existsSync(path.join(dir, 'calls.json')) ? read('calls.json') : [] };
    };
    return { dir, write, read, run, videos, channels, state };
}

test('generador: només canals vençuts, conserva ajornats i detecta reactivació fins i tot en vídeos ocults', t => {
    const specs = [
        { n: 1, latest: '2026-10-01', checked: '2026-10-13T18:00:00Z' },
        { n: 2, latest: '2024-01-01', checked: '2026-10-11T18:00:00Z', rawDate: '2026-10-13', freshId: video(99) },
        { n: 3, latest: '2020-01-01', checked: '2026-10-10T18:00:00Z' },
    ];
    const f = fixture(t, specs);
    f.write('data/hidden-videos.json', { videoIds: [video(99)] });
    const { calls } = f.run();
    assert.deepEqual(calls.filter(c=>c.resource==='channels').flatMap(c=>c.params.id.split(',')), [channel(1),channel(2)]);
    assert.ok(!JSON.stringify(calls).includes(channel(3)));
    assert.deepEqual(f.read('data/feed.json').videos.find(v=>v.channelId===channel(3)), f.videos.find(v=>v.channelId===channel(3)));
    assert.deepEqual(f.read('data/feed.json').channels[channel(3)], f.channels[channel(3)]);
    const state = f.read('data/music-channel-polling.json');
    assert.equal(state.channels[channel(2)].intervalDays, 1);
    assert.equal(state.channels[channel(2)].nextCheckOn, '2026-10-15');
    assert.deepEqual(state.channels[channel(3)], f.state.channels[channel(3)]);
    assert.ok(!f.read('data/feed.json').videos.some(v=>v.id===video(99)));
});

test('generador: sense estat consulta canals nous i classifica 1/3/7 dies, desconeguts cada dia', t => {
    const specs = [{ n: 1, new: true, latest: '2026-10-01' }, { n: 2, latest: '2024-01-01' },
        { n: 3, latest: '2020-01-01' }, { n: 4, empty: true }];
    const f = fixture(t, specs);
    fs.unlinkSync(path.join(f.dir, 'data/music-channel-polling.json'));
    f.run();
    const entries = f.read('data/music-channel-polling.json').channels;
    assert.deepEqual(specs.map(s=>entries[channel(s.n)].intervalDays), [1,3,7,1]);
    assert.deepEqual(specs.map(s=>entries[channel(s.n)].nextCheckOn), ['2026-10-15','2026-10-17','2026-10-21','2026-10-15']);
});

test('generador: fallada de llista conserva més de 100 cançons, índex i revisió, sense avançar el torn', t => {
    const f = fixture(t, [{ n: 1, count: 105, latest: '2020-01-01', checked: '2026-10-01T18:00:00Z' }]);
    const review = [{ id: 'review', channelId: channel(1), contentType: 'review' }];
    f.write('data/music-content-review.json', { videos: review });
    const { calls } = f.run({ fail: 'playlistItems' });
    assert.equal(calls.some(c=>c.resource==='videos'), false);
    assert.deepEqual(f.read('data/feed.json').videos, f.videos);
    assert.equal(f.read('js/channels-ca.json').channels[0].id, channel(1));
    assert.deepEqual(f.read('data/music-content-review.json').videos, review);
    assert.deepEqual(f.read('data/music-channel-polling.json').channels, f.state.channels);
});

test('generador: un canal no resolt conserva fins i tot una fitxa sense cançons', t => {
    const f = fixture(t, [{ n: 1, latest: '2020-01-01' }]);
    f.write('data/feed.json', { channels: f.channels, videos: [] });
    f.run({ unresolved: channel(1) });
    assert.deepEqual(f.read('data/feed.json').channels, f.channels);
    assert.equal(f.read('js/channels-ca.json').channels.length, 1);
    assert.equal(f.read('data/music-channel-polling.json').channels[channel(1)], undefined);
});

test('generador: fallada de detalls nous avorta, sense avançar el calendari ni canviar el feed', t => {
    const f = fixture(t, [{ n: 1, latest: '2020-01-01', freshId: video(99) }]);
    const before = fs.readFileSync(path.join(f.dir, 'data/feed.json'), 'utf8');
    const { result } = f.run({ fail: 'videos', expectFailure: true });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(path.join(f.dir, 'data/feed.json'), 'utf8'), before);
    assert.deepEqual(f.read('data/music-channel-polling.json'), f.state);
});

test('generador: selecció manual conserva només els IDs triats però mesura l’activitat real', t => {
    const f = fixture(t, [{ n: 1, latest: '2020-01-01', rawDate: '2026-10-13', freshId: video(99) }]);
    f.write('data/music-channel-video-allowlist.json', { channels: { [channel(1)]: { allowedVideoIds: [video(1000)] } } });
    f.run();
    assert.equal(f.read('data/music-channel-polling.json').channels[channel(1)].intervalDays, 1);
    assert.ok(!f.read('data/feed.json').videos.some(v=>v.id===video(99)));
});

test('generador: un objectiu manual força només aquell canal i cap més', t => {
    const f = fixture(t, [{ n: 1, latest: '2020-01-01', checked: NOW }, { n: 2, latest: '2026-10-01' }]);
    const { calls } = f.run({ targets: channel(1) });
    assert.deepEqual(calls.filter(c=>c.resource==='channels').flatMap(c=>c.params.id.split(',')), [channel(1)]);
    assert.deepEqual(f.read('data/feed.json').videos.find(v=>v.channelId===channel(2)), f.videos[1]);
});

test('generador: cap canal vençut no fa peticions a YouTube', t => {
    const f = fixture(t, [{ n: 1, latest: '2020-01-01', checked: NOW }]);
    const { calls } = f.run();
    assert.deepEqual(calls, []);
    assert.deepEqual(f.read('data/feed.json').videos, f.videos);
});

test('generador: estat corrupte falla abans de qualsevol consulta o escriptura del feed', t => {
    const f = fixture(t, [{ n: 1, latest: '2020-01-01' }]);
    f.write('data/music-channel-polling.json', { version: 2 });
    const { result, calls } = f.run({ expectFailure: true });
    assert.notEqual(result.status, 0);
    assert.deepEqual(calls, []);
    assert.deepEqual(f.read('data/feed.json').videos, f.videos);
});

test('Tema: els torns de lectura completa vençuts no es perden per saltar un dia', () => {
    const entry = { lastFullTopicAt: '2026-10-05T18:00:00Z' };
    assert.equal(polling.fullTopicDue(entry, new Date('2026-10-11T18:00:00Z')), false);
    assert.equal(polling.fullTopicDue(entry, now), true);
});

test('generador: Tema guarda la lectura completa i la reprèn al primer torn després de set dies', t => {
    const f = fixture(t, [{ n: 1, type: 'topic', latest: '2026-10-01' }]);
    f.run();
    assert.equal(f.read('data/music-channel-polling.json').channels[channel(1)].lastFullTopicAt, NOW);
    f.run({ now: '2026-10-15T18:00:00.000Z' });
    assert.equal(f.read('data/music-channel-polling.json').channels[channel(1)].lastFullTopicAt, NOW);
    f.run({ now: '2026-10-24T18:00:00.000Z' });
    assert.equal(f.read('data/music-channel-polling.json').channels[channel(1)].lastFullTopicAt, '2026-10-24T18:00:00.000Z');
});

test('generador: la discografia forçada consulta un Tema ajornat sense avançar altres canals', t => {
    const f = fixture(t, [{ n: 1, type: 'topic', latest: '2020-01-01', checked: NOW },
        { n: 2, latest: '2020-01-01', checked: NOW }]);
    const { calls } = f.run({ forceTopic: true });
    assert.deepEqual(calls.filter(c=>c.resource==='channels').flatMap(c=>c.params.id.split(',')), [channel(1)]);
    assert.equal(f.read('data/music-channel-polling.json').channels[channel(1)].lastFullTopicAt, NOW);
});

test('generador: un videoclip oficial ajornat evita duplicar la pista del Tema consultat', t => {
    const f = fixture(t, [{ n: 1, latest: '2020-01-01', checked: NOW },
        { n: 2, type: 'topic', latest: '2020-01-01' }]);
    f.write('data/artistes-musica.json', { artists: [{ name: 'Grup', genres: ['Pop'], youtube: { channels: [
        { id: channel(1), type: 'official' }, { id: channel(2), type: 'topic' },
    ] } }] });
    f.videos[0].title = 'Cançó';
    f.write('data/feed.json', { channels: f.channels, videos: f.videos });
    f.run();
    assert.ok(f.read('data/feed.json').videos.some(v=>v.channelId===channel(1)));
    assert.ok(!f.read('data/feed.json').videos.some(v=>v.channelId===channel(2)));
});

test('generador: una verificació fallida del repertori conservat no ajorna el reintent', t => {
    const f = fixture(t, [{ n: 1, empty: true, latest: '2020-01-01', checked: '2026-10-01T18:00:00Z' }]);
    f.run({ fail: 'videos' });
    assert.deepEqual(f.read('data/music-channel-polling.json').channels, f.state.channels);
    assert.ok(f.read('data/feed.json').videos.some(v=>v.id===video(1000)));
});
