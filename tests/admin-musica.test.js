import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../admin-musica.html', import.meta.url), 'utf8');

describe('admin musical', () => {
  it('no conté salts de línia escapats que trenquin el JavaScript inline', () => {
    expect(source).not.toContain('filter(Boolean);\\n originalDb=');
    expect(source).not.toContain('sessió">\\n<button');
  });

  it('permet editar YouTube ID i eliminar artistes', () => {
    expect(source).toContain('function editYoutube(index)');
    expect(source).toContain('function saveYoutubeEditor()');
    expect(source).toContain('validYoutubeId');
    expect(source).toContain(`onclick="editYoutube('+artistIndex+')">Edita ID`);
    expect(source).toContain('function deleteArtist(index)');
    expect(source).toContain(`onclick="deleteArtist('+artistIndex+')">Elimina`);
    expect(source).not.toContain('>Rebutja</button>');
  });

  it('carrega la base i la taxonomia abans de renderitzar', () => {
    expect(source).toContain("fetch(DATA_URL,{cache:'no-store'})");
    expect(source).toContain("fetch(GENRES_URL,{cache:'no-store'})");
    expect(source).toContain('originalDb=clone(remote);');
    expect(source).toContain('render();');
  });
});
