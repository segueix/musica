import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

const ctx = loadScript('js/features/youtube-subscribe.js');
const yt = ctx.SegueixApp.features.youtubeSubscribe;
const OFFICIAL = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const TOPIC = 'UCtttttttttttttttttttttt';
const OTHER = 'UCoooooooooooooooooooooo';
const META = {
    [OFFICIAL]: { type: 'official', primary: true },
    [TOPIC]: { type: 'topic' },
    [OTHER]: { type: 'official' },
};
const metaOf = id => META[id] || null;

describe('Subscripció al canal oficial de YouTube', () => {
    it('l’enllaç obre el diàleg de subscripció del canal', () => {
        expect(yt.subscribeUrl(OFFICIAL)).toBe(`https://www.youtube.com/channel/${OFFICIAL}?sub_confirmation=1`);
        expect(yt.subscribeUrl('')).toBe('');
        expect(yt.subscribeUrl('no-és-un-canal')).toBe('');
    });

    it('tria el canal oficial principal i mai el «Tema»', () => {
        expect(yt.pickOfficialChannel([TOPIC, OTHER, OFFICIAL], metaOf)).toBe(OFFICIAL);
        expect(yt.pickOfficialChannel([TOPIC, OTHER], metaOf)).toBe(OTHER);
        expect(yt.pickOfficialChannel([TOPIC], metaOf)).toBe('');
        // Sense metadades: qualsevol canal que no sigui «Tema»
        expect(yt.pickOfficialChannel(['UCxxxxxxxxxxxxxxxxxxxxxx'], () => null)).toBe('UCxxxxxxxxxxxxxxxxxxxxxx');
    });

    it('proposa una sola vegada per artista i com a màxim una al dia', () => {
        const now = Date.UTC(2026, 9, 7, 12);
        expect(yt.shouldPrompt({}, 'artista-a', now)).toBe(true);
        const after = yt.markPrompted({}, 'artista-a', now);
        expect(yt.shouldPrompt(after, 'artista-a', now + 10 * 86400000)).toBe(false);
        expect(yt.shouldPrompt(after, 'artista-b', now + 3600000)).toBe(false);
        expect(yt.shouldPrompt(after, 'artista-b', now + 86400000)).toBe(true);
        expect(yt.shouldPrompt({}, '', now)).toBe(false);
    });

    it('compta els m’agrada de totes les cançons de l’artista (oficial i «Tema»)', () => {
        const liked = [{ channelId: OFFICIAL }, { channelId: TOPIC }, { channelId: 'UCzzzzzzzzzzzzzzzzzzzzzz' }];
        expect(yt.countArtistLikes(liked, [OFFICIAL, TOPIC])).toBe(2);
        expect(yt.LIKES_TO_PROMPT).toBe(2);
    });

    it('el botó de la fitxa de la cançó fa servir l’enllaç de subscripció i el mòdul es carrega', () => {
        const app = readFileSync('js/app.js', 'utf8');
        const html = readFileSync('index.html', 'utf8');
        expect(app).toContain('SegueixApp.features.youtubeSubscribe?.channelLink?.(channel.id)');
        expect(app).toContain("Subscriu-t'hi a YouTube");
        expect(html).toMatch(/js\/features\/shell-nav\.js[^\n]*\n\s*<script src="js\/features\/youtube-subscribe\.js/);
        // Botó oficial de YouTube a la fitxa (si arriba), amb l'enllaç com a reserva
        expect(app).toContain('data-yt-sub-widget="${youtubeChannel.channelId}"');
        expect(app.match(/youtubeSubscribe\?\.mountWidgets\?\.\(channelInfo\)/g).length).toBe(3);
        const src = readFileSync('js/features/youtube-subscribe.js', 'utf8');
        expect(src).toContain("const PLATFORM_SRC = 'https://apis.google.com/js/platform.js';");
        // Només amb YouTube acceptat, com el reproductor
        expect(src).toMatch(/function renderWidget[\s\S]*?youtubeAllowed\(\)/);
        const css = readFileSync('css/portada.css', 'utf8');
        expect(css).toContain('.btn-pill-red[data-yt-subscribe][hidden]');
    });

    it('la targeta de la proposta mai va damunt del vídeo ni dels seus controls', () => {
        const card = { width: 358, height: 223 };
        const player = { top: 70, bottom: 427, left: 16, right: 374 };
        const controls = { top: 440, bottom: 500, left: 16, right: 374 };
        const overlaps = (pos, r) =>
            pos.left < r.right && pos.left + pos.width > r.left && pos.top < r.bottom && pos.top + card.height > r.top;
        // Mòbil (390 × 844, navegació a 776): al mig de l'espai de sota
        const mobile = yt.choosePromptPosition({ width: 390, bottom: 776, card, obstacles: [player, controls] });
        expect(overlaps(mobile, player) || overlaps(mobile, controls)).toBe(false);
        expect(mobile.left).toBe(16);
        expect(mobile.top).toBeGreaterThanOrEqual(512);
        // Sense reproductor: al centre de la pantalla
        const center = yt.choosePromptPosition({ width: 390, bottom: 844, card, obstacles: [] });
        expect(center.top).toBe(Math.round((844 - 223) / 2));
        // Ordinador: el reproductor a l'esquerra ocupa l'alçada; la targeta va a l'espai lliure de la dreta
        const desktop = yt.choosePromptPosition({
            width: 1280,
            bottom: 800,
            card: { width: 420, height: 230 },
            obstacles: [
                { top: 77, bottom: 597, left: 260, right: 780 },
                { top: 610, bottom: 665, left: 260, right: 780 },
            ],
        });
        expect(desktop.left).toBeGreaterThanOrEqual(792);
    });
});
