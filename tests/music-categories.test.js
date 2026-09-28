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
  });  it('només considera song i live_song elegibles dins les categories musicals', () => {
    expect(music.isCategoryEligibleVideo({ contentType: 'song' })).toBe(true);
    expect(music.isCategoryEligibleVideo({ contentType: 'live_song' })).toBe(true);
    expect(music.isCategoryEligibleVideo({ contentType: 'live-song' })).toBe(true);
    expect(music.isCategoryEligibleVideo({ contentType: 'album' })).toBe(false);
    expect(music.isCategoryEligibleVideo({ contentType: 'other' })).toBe(false);
    expect(music.isCategoryEligibleVideo({ contentType: 'review' })).toBe(false);
  });

  it('manté compatibles els vídeos antics sense contentType fins regenerar el feed', () => {
    expect(music.isCategoryEligibleVideo({})).toBe(true);
  });
});
