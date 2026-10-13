import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';
const app = loadScript('js/features/music-affinities.js').SegueixApp;
const A = app.features.musicAffinities;
const E = loadScript('js/features/music-selection.js', { SegueixApp: app }).SegueixApp.features.musicSelection;
const category = 'Heavy / Metal';
const profiles = A.profilesFor(category);
const song = (p, n = 0) => ({ id: `${p.artist}-${n}`, channelId: p.channelIds[0], channelTitle: p.artist,
    title: `Peça ${p.artist} ${n}`, contentType: 'song', categories: [category], durationSeconds: 210,
    publishedAt: '2026-03-01T12:00:00Z', viewCount: 5000 });
const find = name => song(profiles.find(p => p.artist === name));
function select(videos, extra = {}) {
    return E.selectRadio({ctx:E.createContext({videos,now:Date.parse('2026-10-13T12:00:00Z')}),
        candidates:videos.slice(1),seed:videos[0],signals:E.emptySignals(),count:18,rng:()=>0.5,category,...extra}).queue;
}
describe('afinitats Heavy / Metal', () => {
    it('documenta 23 artistes i tots els 35 canals, amb identitats no duplicades', () => {
        expect(profiles).toHaveLength(23);
        const channels=JSON.parse(readFileSync('js/channels-ca.json','utf8')).channels;
        const ids=profiles.flatMap(p=>p.channelIds);
        expect(ids.length).toBe(35);
        expect(new Set(A.profiles.flatMap(p=>p.channelIds)).size).toBe(57);
        expect(ids.sort()).toEqual(channels.filter(c=>c.categories.includes(category)).map(c=>c.id).sort());
        for(const p of profiles){
            expect(p.sources.length).toBeGreaterThan(0);
            expect(p.reviewedAt).toBe('2026-10-13');
            expect(p.confidence).toBeGreaterThan(0);
            expect(p.confidence).toBeLessThanOrEqual(1);
        }
    });
    it('distingeix heavy/power, death, doom i grindcore amb afinitats simètriques', () => {
        for(const [seed,near,far] of [
            ['Astral Warrior','Sangtraït','Thanatopraxy'], ['Angoixa','Korruption Found','Astral Warrior'],
            ['Bocc','Udol','Astral Warrior'], ['Pesta Porcina','Thanatopraxy','Sangtraït'],
            ['Icestorm','Vrademargk','Entropia'], ['Amargor','Foscor','Sangtraït'],
        ]){
            expect(A.similarity(find(seed),find(near))).toBeGreaterThan(A.similarity(find(seed),find(far)));
            expect(A.similarity(find(seed),find(near))).toBe(A.similarity(find(near),find(seed)));
        }
    });
    it('aplica l’afinitat dins del selector real de Heavy', () => {
        const videos=[find('Angoixa'),find('Astral Warrior'),find('Korruption Found')];
        expect(select(videos,{count:1})[0].channelId).toBe(find('Korruption Found').channelId);
        expect(select(videos,{count:1,affinities:false})[0].channelId).toBe(find('Astral Warrior').channelId);
    });
    it('conserva espaiat, varietat, candidats i desconeguts', () => {
        const videos=profiles.flatMap(p=>[song(p),song(p,1)]);
        videos.push(song({artist:'Desconegut',channelIds:['unknown']}));
        const queue=[videos[0],...select(videos,{count:videos.length-1})];
        expect(queue).toHaveLength(videos.length);
        expect(new Set(queue.map(v=>v.id)).size).toBe(videos.length);
        expect(new Set(queue.map(v=>v.channelId)).size).toBe(24);
        for(let i=1;i<20;i++)expect(queue.slice(Math.max(0,i-3),i).map(v=>v.channelId)).not.toContain(queue[i].channelId);
    });
    it('manté neutres versions i desconeguts i no els exclou', () => {
        const seed=find('Angoixa');
        for(const title of ['Tema (directe)','Tema (acoustic)','Tema (remix)'])expect(A.similarity(seed,{...seed,title})).toBe(0.5);
        expect(A.transition({channelId:'unknown'},seed,seed)).toBe(0);
    });
    it('només activa Ska i Heavy com a categories úniques', () => {
        expect(A.isActive(category)).toBe(true);
        expect(A.isActive([category])).toBe(true);
        expect(A.isActive('Ska / Reggae')).toBe(true);
        const videos=profiles.map(p=>song(p));
        for(const opts of [{category:'Rock'},{category:'Punk'},{category:''},
            {category:[category,'Ska / Reggae']},{policy:'search'},{policy:'historic'},
            {mix:{labels:[category,'Punk'],tagOf:()=>[category]}}]){
            expect(select(videos,opts)).toEqual(select(videos,{...opts,affinities:false}));
        }
    });
});
