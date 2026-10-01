import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  esTitolClaramentCastella,
  esCancoAutorCastella,
  netejaTitol,
} = require('../scripts/ocultar_titols_castella.js');

describe("filtre de títols castellans a Cançó d'autor", () => {
  it('detecta títols clarament castellans', () => {
    for (const title of [
      'Mediterráneo',
      'Hoy puede ser un gran día',
      'Aquellas pequeñas cosas',
      'Tus pies',
      'Gallo rojo',
      'Brillo de Luna',
      'No hago otra cosa que pensar en ti',
      'Cárceles en llamas',
      'Volver',
      'Pueblo blanco',
    ]) {
      expect(esTitolClaramentCastella(title), title).toBe(true);
    }
  });

  it('conserva títols catalans i títols lingüísticament ambigus', () => {
    for (const title of [
      'Per al meu amic',
      'Que tinguem sort',
      "L'estaca",
      'País petit',
      'Camins',
      "Dona'm la mà",
      'Les meves vacances',
      'Amor',
      'Vida',
      'Mar',
      'Sol',
    ]) {
      expect(esTitolClaramentCastella(title), title).toBe(false);
    }
  });

  it("treu el nom de l'artista i les etiquetes editorials abans de classificar", () => {
    expect(netejaTitol('Lluís Llach - Volver (Official Video)', 'Lluís Llach')).toBe('Volver');
    expect(esTitolClaramentCastella('Lluís Llach - Volver (Official Video)', 'Lluís Llach')).toBe(true);
    expect(esTitolClaramentCastella('Cançó meva (Vídeo Oficial)')).toBe(false);
  });

  it("només s'aplica a song/live_song de Cançó d'autor", () => {
    expect(esCancoAutorCastella({
      title: 'Volver',
      channelTitle: 'Artista',
      contentType: 'song',
      categories: ["Cançó d'autor"],
    })).toBe(true);

    expect(esCancoAutorCastella({
      title: 'Volver',
      channelTitle: 'Artista',
      contentType: 'song',
      categories: ['Pop'],
    })).toBe(false);

    expect(esCancoAutorCastella({
      title: 'Volver',
      channelTitle: 'Artista',
      contentType: 'album',
      categories: ["Cançó d'autor"],
    })).toBe(false);
  });
});
