import { describe, it, expect } from 'vitest';
import albumModule from '../scripts/lib/albums_musica.js';

const { extractAlbum, mergeAlbumCatalog } = albumModule;

describe('catàleg local de discos', () => {
  it("extreu disc i any d'una descripció Topic sense cap consulta externa", () => {
    expect(
      extractAlbum(
        'Provided to YouTube by Segell\n\nCançó · Artista\n\nDisc Nou\n\n℗ 2026 Segell\n\nReleased on: 2026-03-04'
      )
    ).toEqual({ title: 'Disc Nou', year: 2026 });
    expect(extractAlbum('Videoclip oficial')).toBeNull();
  });

  it('crea un disc només quan hi ha almenys dues cançons i hi relaciona el videoclip oficial', () => {
    const channels = {
      UCT: { name: 'Artista', artists: ['Artista'] },
      UCO: { name: 'Artista oficial', artists: ['Artista'] },
    };
    const topic = (id, title, views) => ({
      id,
      title,
      channelId: 'UCT',
      channelTitle: 'Artista',
      viewCount: views,
      description: `Provided to YouTube by X\n\n${title} · Artista\n\nEl Disc\n\nReleased on: 2025-01-01`,
    });
    const catalog = mergeAlbumCatalog(
      { artists: {}, channels: {} },
      [
        topic('t1', 'Cançó A', 10),
        topic('t2', 'Cançó B', 20),
        { id: 'clip', title: 'Cançó A', channelId: 'UCO', channelTitle: 'Artista oficial' },
      ],
      channels,
      { generatedAt: '2026-10-02' }
    );
    expect(catalog.artists.Artista.albums).toHaveLength(1);
    expect(catalog.artists.Artista.albums[0].coverVideoId).toBe('t2');
    expect(catalog.artists.Artista.albums[0].trackIds).toContain('clip');
    expect(catalog.channels.UCO).toBe('Artista');
  });

  it('no converteix un single d'una sola pista en un disc', () => {
    const catalog = mergeAlbumCatalog(
      {},
      [{
        id: 's1',
        title: 'Single',
        channelId: 'UC1',
        channelTitle: 'Artista',
        description: 'Provided to YouTube by X\n\nSingle · Artista\n\nSingle\n\nReleased on: 2026-01-01',
      }],
      { UC1: { name: 'Artista', artists: ['Artista'] } },
      { generatedAt: '2026-10-02' }
    );
    expect(catalog.artists.Artista).toBeUndefined();
  });
});
