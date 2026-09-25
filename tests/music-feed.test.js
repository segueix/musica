import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const storage = readFileSync(new URL('../js/utils/storage.js', import.meta.url), 'utf8');
const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const updater = readFileSync(new URL('../scripts/update_music_feed.js', import.meta.url), 'utf8');

describe('neteja i feed musical', () => {
  it('elimina les categories heretades Canal Jove i Canal Història', () => {
    expect(storage).toContain("'canal jove'");
    expect(storage).toContain("'canal historia'");
    expect(data).not.toContain('migrateElsDescontrolatsToCanalJove');
  });

  it('genera el feed des de artistes-musica.json i no des de Google Sheets', () => {
    expect(updater).toContain("artistes-musica.json");
    expect(updater).not.toContain('GOOGLE_SHEET_CSV_URL');
    expect(updater).toContain("channels-ca.json");
  });
});
