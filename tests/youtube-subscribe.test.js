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

    it('proposa una sola vegada per artista, però sí a cada artista nou (sense límit diari)', () => {
        const now = Date.UTC(2026, 9, 8, 12);
        expect(yt.shouldPrompt({}, 'artista-a')).toBe(true);
        const after = yt.markPrompted({}, 'artista-a', now);
        expect(yt.shouldPrompt(after, 'artista-a')).toBe(false);
        expect(yt.shouldPrompt(after, 'artista-b')).toBe(true);
        expect(yt.shouldPrompt({}, '')).toBe(false);
    });

    it('compta els m’agrada de totes les cançons de l’artista (oficial i «Tema»)', () => {
        const liked = [{ channelId: OFFICIAL }, { channelId: TOPIC }, { channelId: 'UCzzzzzzzzzzzzzzzzzzzzzz' }];
        expect(yt.countArtistLikes(liked, [OFFICIAL, TOPIC])).toBe(2);
        expect(yt.LIKES_TO_PROMPT).toBe(2);
    });

    it('la fitxa de la cançó torna a tenir «Canal Youtube» i el mòdul es carrega', () => {
        const app = readFileSync('js/app.js', 'utf8');
        const html = readFileSync('index.html', 'utf8');
        expect(app).toMatch(
            /href="https:\/\/www\.youtube\.com\/channel\/\$\{channel\.id\}"[^>]*class="btn-pill-red">\s*Canal Youtube/
        );
        expect(app).not.toContain('mountWidgets');
        expect(html).toMatch(/js\/features\/shell-nav\.js[^\n]*\n\s*<script src="js\/features\/youtube-subscribe\.js/);
        const src = readFileSync('js/features/youtube-subscribe.js', 'utf8');
        expect(src).toContain("const PLATFORM_SRC = 'https://apis.google.com/js/platform.js';");
        // El botó oficial (a la targeta) només amb YouTube acceptat, com el reproductor
        expect(src).toMatch(/function renderWidget[\s\S]*?youtubeAllowed\(\)/);
    });

    it('el botó «Segueix» de la fitxa d’artista només té un gestor encara que s’hi torni', () => {
        const app = readFileSync('js/app.js', 'utf8');
        const fn = app.match(/function bindFollowButtons[\s\S]*?\n\}/)[0];
        expect(fn).toContain('button._followClickBound');
        expect(fn).toMatch(/const channelId = button\.dataset\.followChannel;\s*const normalizedId/);
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
