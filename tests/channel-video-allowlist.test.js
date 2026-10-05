import { describe, expect, it } from 'vitest';
import {
  normalizeVideoTitle,
  loadChannelVideoAllowlist,
  isChannelVideoAllowed
} from '../scripts/lib/filtre_videos_canal.js';

describe('llista blanca de vídeos per canal', () => {
  it('conserva els títols simbòlics verificats com += sense admetre altres peces', () => {
    const rules = loadChannelVideoAllowlist('/fake.json', {
      readFileSync: () => JSON.stringify({ channels: {
        UCstay: { allowedTitleContains: ['+=', 'Espurna'] }
      } })
    });
    expect(isChannelVideoAllowed(rules, 'UCstay', '+=' )).toBe(true);
    expect(isChannelVideoAllowed(rules, 'UCstay', 'STAY HOMAS - += (Official Video)')).toBe(true);
    expect(isChannelVideoAllowed(rules, 'UCstay', 'STAY HOMAS - Espurna')).toBe(true);
    expect(isChannelVideoAllowed(rules, 'UCstay', 'TROPICAL.mp3')).toBe(false);
  });

    it('bloqueja un canal retirat sense afectar un homònim correcte', () => {
        const rules = loadChannelVideoAllowlist('/fake.json', {
            readFileSync: () =>
                JSON.stringify({
                    channels: {
                        UCretirat: { blocked: true, allowedTitles: ['Hores i Hores'] },
                    },
                }),
        });
        expect(rules.get('UCretirat')?.blocked).toBe(true);
        expect(isChannelVideoAllowed(rules, 'UCretirat', 'Hores i Hores')).toBe(false);
        expect(isChannelVideoAllowed(rules, 'UCretirat', 'Cançó nova')).toBe(false);
        expect(isChannelVideoAllowed(rules, 'UCcorrecte', 'Hores i Hores')).toBe(true);
    });

  it('normalitza accents, puntuació i majúscules', () => {
    expect(normalizeVideoTitle('Subliminal - Ràdios i TVs')).toBe('subliminal radios i tvs');
  });

  it('només accepta els títols autoritzats en un canal restringit', () => {
    const fakeFs = {
      readFileSync() {
        return JSON.stringify({
          channels: {
            UCtest: {
              allowedTitles: [
                'Subliminal - PIKIN',
                'Subliminal - Presumit'
              ]
            }
          }
        });
      }
    };
    const rules = loadChannelVideoAllowlist('/fake.json', fakeFs);
    expect(isChannelVideoAllowed(rules, 'UCtest', 'Subliminal - PIKIN')).toBe(true);
    expect(isChannelVideoAllowed(rules, 'UCtest', 'Subliminal - Presumit')).toBe(true);
    expect(isChannelVideoAllowed(rules, 'UCtest', 'Subliminal - Para la Foto')).toBe(false);
    expect(isChannelVideoAllowed(rules, 'UCaltre', 'Qualsevol vídeo')).toBe(true);
  });

  it('pot fixar un vídeo concret com a font de la icona del canal', () => {
    const fakeFs = {
      readFileSync() {
        return JSON.stringify({
          channels: {
            UCsubliminal: {
              allowedTitles: ['Subliminal - PIKIN', 'Subliminal - Presumit'],
              avatarFromAllowedTitle: 'Subliminal - PIKIN'
            }
          }
        });
      }
    };
    const rules = loadChannelVideoAllowlist('/fake.json', fakeFs);
    expect(rules.get('UCsubliminal')?.avatarFromAllowedTitle).toBe('subliminal pikin');
    expect(rules.get('UCsubliminal')?.avatarFromFirstAllowedVideo).toBe(false);
  });

  it('pot acceptar només vídeos que continguin el nom de l artista', () => {
    const fakeFs = {
      readFileSync() {
        return JSON.stringify({
          channels: {
            UCknockout: {
              allowedTitleContains: ['KnockOut'],
              deniedTitleContains: ['Citylights'],
              acceptedMusicOnly: true,
              allowedContentTypes: ['song', 'live_song'],
              avatarFromFirstAllowedVideo: true
            }
          }
        });
      }
    };
    const rules = loadChannelVideoAllowlist('/fake.json', fakeFs);
    expect(isChannelVideoAllowed(rules, 'UCknockout', 'KNOCKOUT - La vida s atura')).toBe(true);
    expect(isChannelVideoAllowed(rules, 'UCknockout', 'Knock-Out - Directe')).toBe(true);
    expect(isChannelVideoAllowed(rules, 'UCknockout', 'KnockOut - Citylights')).toBe(false);
    expect(isChannelVideoAllowed(rules, 'UCknockout', 'KnockOut - City Lights')).toBe(false);
    expect(isChannelVideoAllowed(rules, 'UCknockout', 'Un altre grup - Cançó')).toBe(false);
    expect(rules.get('UCknockout')?.acceptedMusicOnly).toBe(true);
    expect(rules.get('UCknockout')?.allowedContentTypes.has('song')).toBe(true);
    expect(rules.get('UCknockout')?.allowedContentTypes.has('album')).toBe(false);
    expect(rules.get('UCknockout')?.avatarFromFirstAllowedVideo).toBe(true);
  });

  it('La Trinca: la icona és la caràtula de «Puja a L\'avio» i no es filtra cap cançó', () => {
    const rules = loadChannelVideoAllowlist(new URL('../data/music-channel-video-allowlist.json', import.meta.url).pathname);
    const rule = rules.get('UCKpscwdWlVaMqcA81vLI7OA');
    expect(rule?.avatarFromAllowedTitle).toBe(normalizeVideoTitle("Puja a L'avio"));
    expect(isChannelVideoAllowed(rules, 'UCKpscwdWlVaMqcA81vLI7OA', 'Qualsevol altra cançó')).toBe(true);
  });
});
