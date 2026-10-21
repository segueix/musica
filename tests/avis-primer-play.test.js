import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

// Fitxa de la cançó (2026-10-21): mentre s'espera el primer ▶ dins del vídeo, a sobre del títol s'obre «Prem ▶ al
// reproductor per començar» amb una animació (el títol baixa una mica i el text hi apareix a sobre).
const html = readFileSync('index.html', 'utf8');
const app = readFileSync('js/app.js', 'utf8');
const css = readFileSync('css/portada.css', 'utf8');
const block = css.slice(css.indexOf('/* ---------- Fitxa de la cançó: «Prem ▶ al reproductor per començar»'));

describe('avís «Prem ▶ al reproductor per començar» a sobre del títol', () => {
    it('és dins la informació del vídeo, just abans del títol, i decoratiu per als lectors de pantalla', () => {
        const info = html.slice(html.indexOf('<div class="video-info">'), html.indexOf('id="videoTitle"'));
        expect(info).toMatch(/<div class="native-play-cue" id="nativePlayCue" aria-hidden="true">/);
        expect(info).toContain('Prem ▶ al reproductor per començar');
        // L'avís per als lectors de pantalla continua a la barra de controls
        expect(html).toMatch(/id="playerNativePlayHint" role="status" hidden/);
    });

    it('s’obre mentre s’espera el primer ▶ i es plega quan comença a sonar', () => {
        expect(app).toMatch(
            /getElementById\('nativePlayCue'\)\?\.classList\.toggle\('is-visible', awaiting && hasIframe\)/
        );
    });

    it('l’alçada s’anima (el títol baixa) i el text apareix després; sense animació si es demana menys moviment', () => {
        expect(block).toMatch(/\.native-play-cue \{[^}]*grid-template-rows: 0fr;[^}]*transition: grid-template-rows/);
        expect(block).toMatch(/\.native-play-cue\.is-visible \{[^}]*grid-template-rows: 1fr;/);
        expect(block).toMatch(/\.native-play-cue\.is-visible \.native-play-cue__pill \{[^}]*opacity: 1;/);
        expect(block).toMatch(
            /@media \(prefers-reduced-motion: reduce\) \{[^@]*transition: none;[^@]*animation: none;/
        );
    });

    it('el text de la barra de controls ja no es veu (només per als lectors de pantalla)', () => {
        expect(block).toMatch(/\.player-external-controls \.player-native-play-hint \{[^}]*clip: rect\(0 0 0 0\);/);
    });
});
