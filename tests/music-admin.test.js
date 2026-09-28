import { describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../functions/api/music-admin.js';

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function adminRequest(body, token = 'admin') {
  return new Request('https://segueix.cat/api/music-admin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + token,
      origin: 'https://segueix.cat',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  });
}

describe('administració musical remota', () => {
  it('rebutja peticions sense token administratiu', async () => {
    const response = await onRequestPost({
      request: adminRequest({ changes: [{ key: 'name:test', name: 'Test', genres: ['Pop'] }] }, 'bad'),
      env: { ANALYTICS_ADMIN_TOKEN: 'admin', GITHUB_MUSIC_ADMIN_TOKEN: 'gh' },
    });
    expect(response.status).toBe(401);
  });

  it('fusiona només els camps editorials sobre la base més recent i desa amb el SHA actual', async () => {
    const current = {
      schemaVersion: 1,
      updatedAt: 'old',
      artists: [{
        name: 'Artista',
        wikidataId: 'Q1',
        genres: ['Rock'],
        reviewStatus: 'pendent',
        active: false,
        youtube: { channels: [{ id: 'UC1234567890123456789012', type: 'official', primary: true }], searchCandidates: [{ id: 'keep' }] },
        enrichment: { keep: true },
      }],
    };
    const taxonomy = { categories: [{ label: 'Pop' }, { label: 'Rock' }] };
    let writeBody = null;

    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (String(url).includes('artistes-musica.json') && (!options.method || options.method === 'GET')) {
        return new Response(JSON.stringify({ sha: 'current-sha', content: encode(current) }), { status: 200 });
      }
      if (String(url).includes('music-genres.json')) {
        return new Response(JSON.stringify({ sha: 'genres-sha', content: encode(taxonomy) }), { status: 200 });
      }
      if (options.method === 'PUT') {
        writeBody = JSON.parse(options.body);
        return new Response(JSON.stringify({ commit: { sha: 'new-commit' } }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }));

    const response = await onRequestPost({
      request: adminRequest({ changes: [{
        key: 'wikidata:Q1',
        name: 'Artista',
        genres: ['Pop'],
        reviewStatus: 'aprovat',
        active: true,
      }] }),
      env: { ANALYTICS_ADMIN_TOKEN: 'admin', GITHUB_MUSIC_ADMIN_TOKEN: 'gh' },
    });

    expect(response.status).toBe(200);
    expect(writeBody.sha).toBe('current-sha');
    const saved = JSON.parse(Buffer.from(writeBody.content, 'base64').toString('utf8'));
    expect(saved.artists[0].genres).toEqual(['Pop']);
    expect(saved.artists[0].reviewStatus).toBe('aprovat');
    expect(saved.artists[0].active).toBe(true);
    expect(saved.artists[0].enrichment).toEqual({ keep: true });
    expect(saved.artists[0].youtube.searchCandidates).toEqual([{ id: 'keep' }]);
  });

  it('rebutja categories fora de la taxonomia', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('artistes-musica.json')) {
        return new Response(JSON.stringify({ sha: 's', content: encode({ artists: [{ name: 'Artista', wikidataId: 'Q1', genres: [] }] }) }), { status: 200 });
      }
      return new Response(JSON.stringify({ content: encode({ categories: [{ label: 'Pop' }] }) }), { status: 200 });
    }));

    const response = await onRequestPost({
      request: adminRequest({ changes: [{ key: 'wikidata:Q1', name: 'Artista', genres: ['Inventat'] }] }),
      env: { ANALYTICS_ADMIN_TOKEN: 'admin', GITHUB_MUSIC_ADMIN_TOKEN: 'gh' },
    });
    expect(response.status).toBe(400);
  });
});
