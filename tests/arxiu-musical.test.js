import { describe, it, expect } from 'vitest';
import archiveModule from '../scripts/lib/arxiu_musical.js';

const { splitChannelVideos, compactArchiveVideo, selectHistoryPool } = archiveModule;

const NOW = Date.parse('2026-10-02T00:00:00Z');

const song = (id, date, views, extra = {}) => ({
  id,
  title: 'Cançó ' + id,
  channelId: 'UC1',
  channelTitle: 'Artista',
  publishedAt: date,
  viewCount: views,
  categories: ['Pop'],
  contentType: 'song',
  durationSeconds: 180,
  ...extra,
});

describe('arxiu musical', () => {
  it('manté 12 mesos complets i només les antigues més fortes', () => {
    const videos = [
      song('new', '2026-09-01T00:00:00Z', 10),
      song('old1', '2020-01-01T00:00:00Z', 100),
      song('old2', '2019-01-01T00:00:00Z', 900),
      song('old3', '2018-01-01T00:00:00Z', 500),
    ];
    const result = splitChannelVideos(videos, { now: NOW, hotDays: 365, oldKeepPerChannel: 2 });
    expect(result.hot.map(v => v.id)).toEqual(['new', 'old2', 'old3']);
    expect(result.archive.map(v => v.id)).toEqual(['old1']);
  });

  it('no manté shorts antics només perquè tinguin moltes visualitzacions', () => {
    const videos = [
      song('short', '2018-01-01T00:00:00Z', 999999, { isShort: true, contentType: 'other' }),
      song('song', '2017-01-01T00:00:00Z', 10),
    ];
    const result = splitChannelVideos(videos, { now: NOW, oldKeepPerChannel: 1 });
    expect(result.hot.map(v => v.id)).toEqual(['song']);
    expect(result.archive.map(v => v.id)).toEqual(['short']);
  });

  it("l'historial és compacte i el pool només porta cançons", () => {
    const archived = [
      song('a', '2018-01-01T00:00:00Z', 100),
      song('b', '2019-01-01T00:00:00Z', 900),
      song('x', '2017-01-01T00:00:00Z', 999, { contentType: 'other' }),
    ];
    expect(compactArchiveVideo({ ...archived[0], description: 'fora', thumbnail: 'fora' })).toEqual({
      id: 'a',
      title: 'Cançó a',
      channelId: 'UC1',
      channelTitle: 'Artista',
      publishedAt: '2018-01-01T00:00:00Z',
      viewCount: 100,
      categories: ['Pop'],
      contentType: 'song',
      durationSeconds: 180,
    });
    expect(selectHistoryPool(archived, 1).map(v => v.id)).toEqual(['b']);
  });
});
