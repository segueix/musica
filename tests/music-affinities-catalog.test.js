import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadScript } from './setup.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { preserveGenres } = require('../scripts/lib/preservar_generes');
const catalog = loadScript('js/features/music-affinity-catalog.js').SegueixMusicAffinityCatalog;
const app = loadScript('js/features/music-affinities.js', { SegueixMusicAffinityCatalog: catalog }).SegueixApp;
const A = app.features.musicAffinities;
const E = loadScript('js/features/music-selection.js', { SegueixApp: app }).SegueixApp.features.musicSelection;
const feed = JSON.parse(readFileSync('data/feed.json', 'utf8'));
const channels = JSON.parse(readFileSync('js/channels-ca.json', 'utf8')).channels;
const find = name => A.profiles.find(p => p.artist === name);
const song = name => { const p = find(name), channelId = p.channelIds[0]; return {
    id: p.allowedVideoIdsByChannel?.[channelId]?.[0] || name, channelId, title: 'Peça', contentType: 'song' }; };
describe('cobertura completa d’afinitats', () => {
    it('cada canal musical publicat té un únic perfil amb evidència i gènere', () => {
        const program = 'UCdezTX23syEeAJJAb2oOkKA';
        for (const c of channels.filter(c => c.id !== program)) {
            const owners = A.profiles.filter(p => p.channelIds.includes(c.id));
            expect(owners, c.name).toHaveLength(1);
            expect(owners[0].facets.length, c.name).toBeGreaterThan(0);
            expect(owners[0].categories.length, c.name).toBeGreaterThan(0);
            expect(owners[0].sources.length, c.name).toBeGreaterThan(0);
            expect(c.categories.length, c.name).toBeGreaterThan(0);
        }
        const db = JSON.parse(readFileSync('data/artistes-musica.json', 'utf8'));
        const published = new Set(channels.map(c => c.id));
        expect(A.profiles).toHaveLength(db.artists.filter(a => a.name !== 'Club Social Carme' && a.youtube?.channels?.some(c => published.has(c.id))).length);
        expect(find('Club Social Carme')).toBeUndefined();
    });
    it('Knockouts té 10 cançons elegibles a Ska i les relacions són simètriques', () => {
        const p = find('knocKouts');
        const tracks = feed.videos.filter(v => p.channelIds.includes(v.channelId));
        expect(tracks.length).toBeGreaterThanOrEqual(10);
        expect(tracks.every(v => v.categories.includes('Ska / Reggae') && A.profileOf(v))).toBe(true);
        for (const name of ['Dr. Calypso', 'Skatalà', 'Frontpilsen']) {
            expect(A.relationOf(p, find(name))?.type).toBe('shared-members');
            expect(A.similarity(song(name), song('knocKouts'))).toBe(A.similarity(song('knocKouts'), song(name)));
        }
    });
    it('les relacions augmenten lleument la proximitat sense obrir la categoria', () => {
        const p = find('knocKouts'), other = find('Dr. Calypso');
        const common = p.facets.filter(f => other.facets.includes(f)).length;
        const plain = .5 + (common / new Set([...p.facets, ...other.facets]).size - .5) * Math.min(p.confidence, other.confidence);
        expect(A.similarity(song(p.artist), song(other.artist))).toBeCloseTo(plain + .08);
        const videos = feed.videos.filter(v => v.categories.includes('Ska / Reggae'));
        const seed = videos.find(v => p.channelIds.includes(v.channelId));
        const q = E.selectRadio({ctx:E.createContext({videos}),seed,candidates:videos.filter(v=>v.id!==seed.id),category:'Ska / Reggae',count:39,signals:E.emptySignals(),rng:()=>.5}).queue;
        expect(q.every(v=>v.categories.includes('Ska / Reggae'))).toBe(true);
        expect(q.some(v=>find('Frontpilsen').channelIds.includes(v.channelId))).toBe(false);
    });
    it('els perfils bàsics pesen menys i no es presenten com a revisió detallada', () => {
        const basic = A.profiles.filter(p => p.evidenceLevel === 'category-only');
        expect(basic.length).toBeGreaterThan(0);
        expect(basic.every(p => p.confidence <= .3 && p.reviewedAt === null)).toBe(true);
        expect(find('Coça').facets.length).toBeGreaterThan(0);
        expect(find('Vàlius').facets.length).toBeGreaterThan(0);
    });
    it('cap perfil de canal compartit s’aplica fora de la selecció identificada', () => {
        for (const p of A.profiles.filter(p => p.allowedVideoIdsByChannel)) for (const id of Object.keys(p.allowedVideoIdsByChannel)) {
            expect(A.profileOf({id:'unknown',channelId:id,title:'Peça',contentType:'song'}),p.artist).toBeNull();
        }
    });
    it('les ràdios mixtes, les cerques i les versions continuen fora de l’ajust', () => {
        for (const c of A.enabledCategories) { expect(A.isActive(c)).toBe(true); expect(A.isActive(c,'search')).toBe(false); }
        expect(A.isActive(['Pop','Rock'])).toBe(false);
        expect(A.isActive('Pop','general',{})).toBe(false);
        expect(A.profileOf({...song('knocKouts'),contentType:'live_song'})).toBeNull();
    });
    it('una consulta externa buida no elimina gèneres previs ni decisions manuals', () => {
        const allowed = new Set(['Pop','Rock','Ska / Reggae']);
        expect(preserveGenres({genres:['Ska / Reggae']},[],allowed)).toEqual(['Ska / Reggae']);
        expect(preserveGenres({genres:['Pop'],sources:['genre:manual']},['Rock'],allowed)).toEqual(['Pop']);
        expect(preserveGenres({genres:['Pop']},['Rock'],allowed)).toEqual(['Rock']);
        expect(preserveGenres({genres:['Pop']},['unknown'],allowed)).toEqual(['Pop']);
    });
});
