import { describe, expect, it } from 'vitest';
import music from '../js/music-categories.js';

describe('taxonomia de navegació musical', () => {
  it('agrupa Punk i Metal en una sola secció', () => {
    expect(music.navigationCategoriesForGenres(['Punk', 'Metal'])).toContain('Punk / Metal');
  });
  it('agrupa clàssica i coral', () => {
    expect(music.navigationCategoriesForGenres(['Coral / Vocal'])).toContain('Clàssica');
  });
  it('manté els estils principals separats', () => {
    expect(music.navigationCategoriesForGenres(['Pop', 'Rock', 'Indie / Alternativa'])).toEqual(['Pop','Rock','Indie']);
  });
});
