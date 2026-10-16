import { describe, it, expect } from 'vitest';
import releases from '../scripts/lib/llancaments_musicals.js';
import { canalsRevisats } from '../scripts/lib/canals_revisats.js';

const release = { id: 'disc', status: 'validated', artist: 'Anna', title: 'Disc', type: 'album',
  sourceType: 'official_playlist', channelIds: ['official', 'topic'],
  playlists: [{ id: 'list', ownerChannelId: 'official' }], ignoredVideoIds: ['full'],
  tracks: [{ title: 'Primer', videos: [{ id: 'aaaaaaaaaaa', channelId: 'official' }, { id: 'bbbbbbbbbbb', channelId: 'topic' }] },
    { title: 'Segon', videos: [{ id: 'ccccccccccc', channelId: 'official' }] }] };
const channels = { official: {}, topic: {} };
const registry = { releases: [release] };

describe('llançaments prioritaris', () => {
  it('unifica canals i conserva ordre, variants i prioritat sobre el catàleg inferit', () => {
    const catalog = { channels: {}, artists: { Anna: { albums: [{ id: 'old', title: 'Dísc', trackIds: ['wrong'] }] } } };
    releases.applyReleaseCatalog(catalog, { releases: [{ ...release, sourceType: 'release', year: 2025 }, release] }, { channels });
    expect(catalog.channels).toEqual({ official: 'Anna', topic: 'Anna' });
    expect(catalog.artists.Anna.albums).toHaveLength(1);
    expect(catalog.artists.Anna.albums[0]).toMatchObject({ id: 'old', year: 2025, sourceType: 'release', trackIds: ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'] });
  });
  it('respecta vídeos ocults i admet un senzill explícit', () => {
    const catalog = releases.applyReleaseCatalog({ channels: {}, artists: {} }, { releases: [{ ...release, type: 'single' }] }, { channels, hiddenIds: new Set(['aaaaaaaaaaa', 'bbbbbbbbbbb']) });
    expect(catalog.artists.Anna.albums[0].trackIds).toEqual(['ccccccccccc']);
    expect(catalog.artists.Anna.albums[0].type).toBe('single');
    expect([...releases.idsByChannel(registry, new Set(['official'])).keys()]).toEqual(['official']);
  });
  it('no accepta automàticament noves pistes i reutilitza la comprovació setmanal', async () => {
    let calls = 0;
    const api = async (endpoint, args) => {
      calls++;
      if (endpoint === 'playlistItems') return args.pageToken ? { items: [{ contentDetails: { videoId: 'new' } }] } : { items: [{ contentDetails: { videoId: 'full' } }], nextPageToken: 'next' };
      return args.id ? { items: [{ snippet: { channelId: 'official' } }] } : { items: [{ id: 'candidate', snippet: { title: 'Nou disc' } }] };
    };
    const options = { activeIds: new Set(['official']), now: '2026-10-12T00:00:00Z' };
    const state = await releases.refreshSources(registry, {}, api, options);
    expect(state.playlists.list.pendingVideoIds).toEqual(['new']);
    expect(state.discoveries.official.candidates).toHaveLength(1);
    expect(release.tracks).toHaveLength(2);
    const firstCalls = calls;
    await releases.refreshSources(registry, state, api, { ...options, now: '2026-10-13T00:00:00Z' });
    expect(calls).toBe(firstCalls);
    const failed = await releases.refreshSources(registry, state, async () => { throw new Error('offline'); }, { ...options, now: '2026-10-20T00:00:00Z' });
    expect(failed.playlists.list.videoIds).toEqual(state.playlists.list.videoIds);
    expect(failed.playlists.list.lastError).toBe('offline');
  });
  it('rebutja una llista amb propietari diferent', async () => {
    const state = await releases.refreshSources(registry, {}, async () => ({ items: [{ snippet: { channelId: 'foreign' } }] }), { activeIds: new Set(['official']) });
    expect(state.playlists.list.lastError).toBe('Propietari inesperat');
    expect(state.playlists.list.videoIds).toBeUndefined();
  });
  it('delimita els canals d’un registre nou o retirat', () => {
    const base = { abans: {}, despres: {}, shortsAbans: {}, shortsDespres: {}, feed: {}, actuals: new Set(['official', 'topic', 'other']) };
    expect(canalsRevisats({ ...base, releasesDespres: registry })).toEqual(['official', 'topic']);
    expect(canalsRevisats({ ...base, releasesAbans: registry })).toEqual(['official', 'topic']);
  });
});
