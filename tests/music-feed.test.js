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

  it('treu el sufix Topic dels noms mostrats sense perdre la detecció interna', () => {
    expect(updater).toContain('function cleanChannelDisplayName(');
    expect(updater).toContain("replace(/\\s*-\\s*(?:topic|tòpic)\\s*$/i,'')");
    expect(updater).toContain('channelTitle:rawChannelName');
  });

  it('genera el feed des de artistes-musica.json i no des de Google Sheets', () => {
    expect(updater).toContain("artistes-musica.json");
    expect(updater).not.toContain('GOOGLE_SHEET_CSV_URL');
    expect(updater).toContain("channels-ca.json");
  });

  // scripts/test_activitat_musica.cjs l'executa en una carpeta temporal amb només scripts/lib: el generador no pot
  // carregar scripts de revisió (2026-10-17, la CI fallava amb «Cannot find module './revisions/…'»).
  it('no depèn de cap script de revisió: les baixes es llegeixen del fitxer de decisions', () => {
    expect(updater).not.toMatch(/require\(['"]\.\/revisions\//);
    expect(updater).toContain("'2026-10-13-supervisio-idioma-decisions.json'");
    expect(updater).toMatch(/readJsonSafe\(SUPERVISION_DECISIONS_FILE,\{remove:\[\]\}\)/);
  });
});
