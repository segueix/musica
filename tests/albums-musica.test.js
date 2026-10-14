import { describe, it, expect } from 'vitest';
import albumModule from '../scripts/lib/albums_musica.js';

const { extractAlbum, extractOfficialAlbum, mergeAlbumCatalog } = albumModule;

describe('catàleg local de discos', () => {
  it('un artista nou completa el disc amb pistes rebudes en dies diferents', () => {
    const channels = { UC1: { artists: ['Nou artista'] } };
    const track = (id, title) => ({ id, title, channelId: 'UC1',
      description: `Provided to YouTube by X\n\n${title} · Nou artista\n\nPrimer disc\n\nReleased on: 2026-01-01` });
    const first = mergeAlbumCatalog({}, [track('a', 'Primera')], channels);
    expect(first.artists['Nou artista']).toBeUndefined();
    expect(first.pendingAlbums['Nou artista']).toHaveLength(1);
    const second = mergeAlbumCatalog(first, [track('b', 'Segona')], channels);
    expect(second.artists['Nou artista'].albums[0].trackIds).toEqual(['a', 'b']);
    expect(second.pendingAlbums['Nou artista']).toBeUndefined();
    expect(second.channels.UC1).toBe('Nou artista');
  });

  it('accepta declaracions explícites però no confon crèdits ni mencions contradictòries', () => {
    expect(extractOfficialAlbum('Album: Despertem!')).toEqual({ title: 'Despertem!', year: 0 });
    expect(extractOfficialAlbum('Cançó del disc "Cançons d’amor".')).toEqual({ title: 'Cançons d’amor', year: 0 });
    expect(extractOfficialAlbum('Cançó inclosa al nou disc de Kòdul "La nostra resposta".', 'Kòdul')?.title).toBe('La nostra resposta');
    expect(extractOfficialAlbum('Cançó del disc del grup "Artista" que es diu "Disc".')).toBeNull();
    expect(extractOfficialAlbum('Album: Un\nDisc: Altre')).toBeNull();
    expect(extractOfficialAlbum('Escolta la llista dels nostres èxits')).toBeNull();
  });

  it('agrupa títols oficials nets, exclou ocults i no barreja versions ni discos ambigus', () => {
    const previous = { artists: { Grup: { albums: [
      { id: 'one', title: 'Disc', trackIds: ['a', 'b'], keys: ['llum', 'cel'] },
      { id: 'two', title: 'Altre', trackIds: ['c'], keys: ['cel'] },
    ] } } };
    const channels = { UC1: { artists: ['Grup'] } };
    const videos = [
      { id: 'clip', title: 'Grup - Llum (Videoclip Oficial)' },
      { id: 'live', title: 'Grup - Llum (en directe)' },
      { id: 'ambiguous', title: 'Grup - Cel (Official Audio)' },
      { id: 'hidden', title: 'Grup - Llum' },
    ].map(v => ({ ...v, channelId: 'UC1' }));
    const result = mergeAlbumCatalog(previous, videos, channels, { hiddenIds: new Set(['hidden', 'b']) });
    expect(result.artists.Grup.albums.find(a => a.id === 'one').trackIds).toEqual(['a', 'clip']);
    expect(result.artists.Grup.albums.find(a => a.id === 'two').trackIds).toEqual(['c']);
  });

  it('extreu discos del canal oficial sense incorporar directes ni entrevistes', () => {
    const videos = [
      { id: 'a', title: 'Primera' }, { id: 'b', title: 'Segona' },
      { id: 'live', title: 'Primera (Live)' },
      { id: 'interview', title: 'Entrevista', contentType: 'interview' },
    ].map(v => ({ ...v, channelId: 'UC1', description: 'Album: Despertem!' }));
    const result = mergeAlbumCatalog({}, videos, { UC1: { artists: ['Grup'] } });
    expect(result.artists.Grup.albums[0].trackIds).toEqual(['a', 'b']);
    expect(result.artists.Grup.albums[0].sourceType).toBe('channel_metadata');
  });

  it('no confon el nom del disc entre cometes amb el títol de totes les pistes', () => {
    const videos = ['Sirena', 'Eufòria'].map((title, i) => ({ id: String(i),
      title: `0${i + 1} ${title} - Ovella Xao "Trempera Matinera"`, channelId: 'UC1',
      description: 'Cançó del primer disc "Trempera Matinera".',
    }));
    const catalog = mergeAlbumCatalog({}, videos, { UC1: { artists: ['Ovella Xao'] } });
    expect(catalog.artists['Ovella Xao'].albums[0].keys).toEqual(['sirena', 'euforia']);
  });
  it('mostra l’any original verificat i corregeix l’any d’una reedició ja catalogada', () => {
    const tracks = ['a', 'b'].map(id => ({
      id, title: id, channelId: 'UC1', channelTitle: 'Serrat',
      description: `Provided to YouTube by Ariola\n\n${id} · Serrat\n\nDisc antic\n\nReleased on: 2000-07-20`,
      originalYear: 1967, originalYearSource: 'manual',
    }));
    const prior = mergeAlbumCatalog({}, tracks.map(({ originalYearSource, ...v }) => v), {});
    expect(prior.artists.Serrat.albums[0].year).toBe(2000);
    const result = mergeAlbumCatalog(prior, tracks, {});
    expect(result.artists.Serrat.albums[0].year).toBe(1967);
  });

  it('conserva les sessions convidades encara que només tinguin una pista i no arribin des de Topic', () => {
    const session = {
      id: 'live_carme_session', title: 'Club Social Carme (en directe)',
      coverVideoId: 'session', trackIds: ['session'], keys: [], sourceChannelId: 'UCClub',
    };
    const result = mergeAlbumCatalog({
      channels: { UCArtist: 'Artista' }, artists: { Artista: { albums: [session] } },
    }, [], {}, { generatedAt: '2026-10-09' });
    expect(result.artists.Artista.albums).toEqual([session]);
    expect(result.channels.UCArtist).toBe('Artista');
  });

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

  it("no converteix un single d'una sola pista en un disc", () => {
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


