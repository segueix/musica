import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { loadScript } from './setup.js';
const require = createRequire(import.meta.url);
const policy = require('../js/catalog-policy.js');
const { selectCatalog } = require('../scripts/lib/cataleg_public.js');
const now = Date.parse('2026-10-17T12:00:00Z');
const old = Array.from({ length: 25 }, (_, i) => ({ id: `song${String(i).padStart(7, '0')}`, channelId: i % 2 ? 'topic' : 'official',
    title: `Cançó ${i}`, viewCount: 1000 - i, contentType: 'song', publishedAt: '2020-01-01' }));
const fresh = { id: 'fresh000001', channelId: 'official', title: 'Nova', viewCount: 1, contentType: 'song', publishedAt: '2026-10-01' };

describe('21 populars i novetats de 12 mesos', () => {
    it('afegeix novetats fora del top 21, sense duplicar-les, i les ordena per data', () => {
        const newer = { ...fresh, id: 'fresh000002', publishedAt: '2026-10-10' };
        const m = policy.selectArtist([...old, fresh, newer, fresh], { now });
        expect(m.popular).toHaveLength(21);
        expect(m.recent.map(v => v.id)).toEqual([newer.id, fresh.id]);
        expect(m.all).toHaveLength(23);
        expect(m.best.id).toBe(old[0].id);
        expect(m.rest).toHaveLength(20);
    });
    it('promou una novetat al lloc exacte del rànquing i la retira de Novetats', () => {
        const promoted = { ...fresh, viewCount: 998.5 };
        const m = policy.selectArtist([...old, promoted], { now });
        expect(m.popular[2].id).toBe(fresh.id);
        expect(m.recent).toHaveLength(0);
        expect(m.all).toHaveLength(21);
        expect(m.all.some(v => v.id === old[20].id)).toBe(false);
    });
    it('caduca a l’aniversari, inclòs el 29 de febrer, sense retirar les populars', () => {
        const boundary = { ...fresh, publishedAt: '2025-10-17T12:00:00Z' };
        expect(policy.isRecent(boundary, now - 1)).toBe(true);
        expect(policy.isRecent(boundary, now)).toBe(false);
        expect(policy.selectArtist([...old, boundary], { now }).all).toHaveLength(21);
        expect(policy.anniversary(Date.parse('2024-02-29T12:00:00Z'))).toBe(Date.parse('2025-02-28T12:00:00Z'));
        expect(policy.selectArtist([boundary], { now }).popular).toHaveLength(1);
    });
    it('no presenta reedicions antigues, dates futures o desconegudes com a novetats', () => {
        for (const extra of [{ originalYear: 1980 }, { originalDate: '1980-01-01' }, { publishedAt: '2030-01-01' }, { publishedAt: '' }]) {
            expect(policy.isRecent({ ...fresh, ...extra }, now)).toBe(false);
        }
    });
    it('els directes entren per visualitzacions, sense places addicionals de novetat', () => {
        const live = { ...fresh, contentType: 'live_song' };
        expect(policy.selectArtist([...old, live], { now }).all).toHaveLength(21);
        expect(policy.selectArtist([...old, { ...live, viewCount: 2000 }], { now }).best.contentType).toBe('live_song');
    });
    it('exclou Shorts i contingut no musical; resol empats igual amb qualsevol ordre d’entrada', () => {
        expect(policy.selectArtist([{ ...fresh, isShort: true }, { ...old[0], contentType: 'interview' }], { now }).total).toBe(0);
        const ties = old.map(v => ({ ...v, viewCount: 1 }));
        expect(policy.selectArtist(ties, { now }).all).toEqual(policy.selectArtist([...ties].reverse(), { now }).all);
    });
    it('comparteix el límit entre oficial i Tema i conserva separats els homònims', () => {
        const a = { id: 'official', name: 'Grup', channelIds: ['official', 'topic'] };
        const b = { id: 'homonym', name: 'Grup', channelIds: ['homonym'] };
        const other = old.map(v => ({ ...v, id: v.id.replace('song', 'othr'), channelId: 'homonym' }));
        const m = selectCatalog({ artists: [a, b], artistByChannel: new Map([['official', a], ['topic', a], ['homonym', b]]), songs: [...old, ...other, fresh] }, { now });
        expect(m.counts).toMatchObject({ popular: 42, recent: 1, total: 43 });
        expect(m.models.get(a.id).popular).toHaveLength(21);
    });
    it('atribueix un directe convidat només a l’artista editorial corresponent', () => {
        const a = { id: 'official', channelIds: ['official', 'topic'] };
        const h = { id: 'host', channelIds: ['host'] };
        const live = { ...fresh, channelId: 'host', contentType: 'live_song', viewCount: 5000 };
        const m = selectCatalog({ artists: [a, h], artistByChannel: new Map([['official', a], ['topic', a], ['host', h]]), songs: [...old, live] },
            { now, albums: { channels: { official: 'grup' }, artists: { grup: { albums: [{ sourceChannelId: 'host', trackIds: [live.id] }] } } } });
        expect(m.models.get(a.id).best.id).toBe(live.id);
        expect(m.models.get(a.id).popular).toHaveLength(21);
        expect(m.counts.total).toBe(21); // El directe compartit compta una vegada.
    });
    it('la fitxa amaga Novetats buides i mostra les noves abans del número 2', () => {
        const nodes = new Map(['apBest', 'apRecent', 'apRecentSongs', 'apSongs', 'apSongsMore', 'apStats', 'apSongsEmpty'].map(id => [id, { hidden: true, innerHTML: '', textContent: '' }]));
        const page = loadScript('js/features/artist-page.js', { SegueixCatalogPolicy: policy,
            document: { getElementById: id => nodes.get(id) } }).SegueixApp.features.artistPage;
        page.renderSongs({ videos: [...old, { ...fresh, publishedAt: new Date().toISOString() }] });
        expect(nodes.get('apRecent').hidden).toBe(false);
        expect(nodes.get('apRecentSongs').innerHTML).toContain(fresh.id);
        expect(nodes.get('apRecentSongs').innerHTML).not.toContain('ap-card__rank');
        expect(nodes.get('apSongs').innerHTML).toContain('>#2<');
        expect(nodes.get('apSongs').innerHTML).toContain('>#21<');
        page.renderSongs({ videos: old });
        expect(nodes.get('apRecent').hidden).toBe(true);
        expect(nodes.get('apRecentSongs').innerHTML).toBe('');
    });
});
