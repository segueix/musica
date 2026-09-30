import { describe, expect, it } from 'vitest';
import {
  normalizeVideoTitle,
  loadChannelVideoAllowlist,
  isChannelVideoAllowed
} from '../scripts/lib/filtre_videos_canal.js';

describe('llista blanca de vídeos per canal', () => {
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
});
