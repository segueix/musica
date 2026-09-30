import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

const ctx = loadScript('js/utils/helpers.js', { YouTubeAPI: undefined });

// Extreure les funcions globals del sandbox
const normalizeSearchText = ctx.normalizeSearchText;
const isMatch = ctx.isMatch;
const getVideoDisplayDuration = ctx.getVideoDisplayDuration;
const buildArchiveThumbnail = ctx.buildArchiveThumbnail;
const getPreferredThumbnail = ctx.getPreferredThumbnail;
const addTripleTapDeleteGuard = ctx.addTripleTapDeleteGuard;

// ==================== normalizeSearchText ====================
describe('normalizeSearchText', () => {
    it('elimina accents i passa a minúscules', () => {
        expect(normalizeSearchText('Víctor Puig')).toBe('victor puig');
        expect(normalizeSearchText('Àlex Gómez')).toBe('alex gomez');
    });
});

// ==================== isMatch ====================
describe('isMatch', () => {
    it('retorna false si text o query són buits', () => {
        expect(isMatch('', 'foo')).toBe(false);
        expect(isMatch('foo', '')).toBe(false);
        expect(isMatch(null, 'foo')).toBe(false);
        expect(isMatch('foo', null)).toBe(false);
    });

    it('fa matching per paraula sencera (word boundary)', () => {
        expect(isMatch('Hello world', 'world')).toBe(true);
        expect(isMatch('Hello world', 'worl')).toBe(false);
        expect(isMatch('Hello world', 'hello')).toBe(true); // case insensitive
    });

    it('fa matching sense tenir en compte accents', () => {
        expect(isMatch('Víctor Puig', 'Victor')).toBe(true);
        expect(isMatch('Victor Puig', 'Víctor')).toBe(true);
        expect(isMatch("El canal d'Àlex Gómez", 'Alex Gomez', true)).toBe(true);
    });

    it('fa matching exact amb cometes', () => {
        expect(isMatch('Hello beautiful world', '"beautiful world"')).toBe(true);
        expect(isMatch('Hello beautiful world', '"hello beautiful"')).toBe(true);
        expect(isMatch('Hello beautiful world', '"hello world"')).toBe(false);
    });

    it('fa matching exact amb forceExact=true', () => {
        expect(isMatch('Hello beautiful world', 'beautiful world', true)).toBe(true);
        expect(isMatch('Hello beautiful world', 'hello world', true)).toBe(false);
    });

    it('escapa caràcters especials de regex', () => {
        expect(isMatch('preu: 10.00€', '10.00', true)).toBe(true);
        expect(isMatch('f(x)', 'f(x)', true)).toBe(true);
    });
});

// ==================== getVideoDisplayDuration ====================
describe('getVideoDisplayDuration', () => {
    it('formata durationSeconds en MM:SS', () => {
        expect(getVideoDisplayDuration({ durationSeconds: 125 })).toBe('2:05');
        expect(getVideoDisplayDuration({ durationSeconds: 60 })).toBe('1:00');
        expect(getVideoDisplayDuration({ durationSeconds: 5 })).toBe('0:05');
    });

    it('formata durationSeconds en HH:MM:SS quan hi ha hores', () => {
        expect(getVideoDisplayDuration({ durationSeconds: 3661 })).toBe('1:01:01');
        expect(getVideoDisplayDuration({ durationSeconds: 7200 })).toBe('2:00:00');
    });

    it('parseja format ISO 8601 PT', () => {
        expect(getVideoDisplayDuration({ duration: 'PT3M45S' })).toBe('3:45');
        expect(getVideoDisplayDuration({ duration: 'PT1H2M3S' })).toBe('1:02:03');
        expect(getVideoDisplayDuration({ duration: 'PT30S' })).toBe('0:30');
        expect(getVideoDisplayDuration({ duration: 'PT1H' })).toBe('1:00:00');
        expect(getVideoDisplayDuration({ duration: 'PT5M' })).toBe('5:00');
    });

    it('retorna string buit si no hi ha duració', () => {
        expect(getVideoDisplayDuration({})).toBe('');
        expect(getVideoDisplayDuration({ duration: '' })).toBe('');
        expect(getVideoDisplayDuration(null)).toBe('');
        expect(getVideoDisplayDuration(undefined)).toBe('');
    });

    it('retorna la duració tal qual si no és format PT', () => {
        expect(getVideoDisplayDuration({ duration: '3:45' })).toBe('3:45');
        expect(getVideoDisplayDuration({ duration: '10:00' })).toBe('10:00');
    });

    it('usa contentDetails.duration com a fallback', () => {
        expect(getVideoDisplayDuration({ contentDetails: { duration: 'PT2M30S' } })).toBe('2:30');
    });

    it('durationSeconds té prioritat sobre duration string', () => {
        expect(getVideoDisplayDuration({ durationSeconds: 90, duration: 'PT5M' })).toBe('1:30');
    });
});

// ==================== buildArchiveThumbnail ====================
describe('buildArchiveThumbnail', () => {
    it('construeix URL de thumbnail de YouTube', () => {
        expect(buildArchiveThumbnail('abc123')).toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg');
    });

    it('retorna fallback si videoId és buit', () => {
        expect(buildArchiveThumbnail('')).toBe('img/icon-192.png');
        expect(buildArchiveThumbnail(null)).toBe('img/icon-192.png');
        expect(buildArchiveThumbnail(undefined)).toBe('img/icon-192.png');
    });

    it('codifica caràcters especials al videoId', () => {
        expect(buildArchiveThumbnail('a b')).toBe('https://i.ytimg.com/vi/a%20b/hqdefault.jpg');
    });
});

// ==================== getPreferredThumbnail ====================
describe('getPreferredThumbnail', () => {
    it('retorna video.thumbnail si existeix', () => {
        expect(getPreferredThumbnail({ thumbnail: 'direct.jpg' })).toBe('direct.jpg');
    });

    it('fa fallback a snippet.thumbnails per qualitat', () => {
        const video = {
            snippet: {
                thumbnails: {
                    default: { url: 'default.jpg' },
                    medium: { url: 'medium.jpg' },
                    high: { url: 'high.jpg' },
                    standard: { url: 'standard.jpg' },
                    maxres: { url: 'maxres.jpg' },
                },
            },
        };
        expect(getPreferredThumbnail(video)).toBe('maxres.jpg');
    });

    it('fa fallback parcial quan falten resolucions', () => {
        const video = {
            snippet: {
                thumbnails: {
                    default: { url: 'default.jpg' },
                    medium: { url: 'medium.jpg' },
                },
            },
        };
        expect(getPreferredThumbnail(video)).toBe('medium.jpg');
    });

    it('retorna string buit si no hi ha cap thumbnail', () => {
        expect(getPreferredThumbnail({})).toBe('');
        expect(getPreferredThumbnail({ snippet: {} })).toBe('');
    });
});


describe('addTripleTapDeleteGuard', () => {
    it('executa callback només al tercer toc', () => {
        const listeners = {};
        const attrs = new Map();
        const element = {
            addEventListener: (name, handler) => {
                listeners[name] = listeners[name] || [];
                listeners[name].push(handler);
            },
            setAttribute: (name, value) => attrs.set(name, value),
            removeAttribute: (name) => attrs.delete(name),
        };

        let calls = 0;
        addTripleTapDeleteGuard(element, () => { calls += 1; });

        const clickHandlers = listeners.click || [];
        expect(clickHandlers.length).toBe(1);

        const makeEvt = () => ({ preventDefault() {}, stopPropagation() {} });
        clickHandlers[0](makeEvt());
        expect(calls).toBe(0);
        expect(attrs.get('data-delete-taps')).toBe('1');

        clickHandlers[0](makeEvt());
        expect(calls).toBe(0);
        expect(attrs.get('data-delete-taps')).toBe('2');

        clickHandlers[0](makeEvt());
        expect(calls).toBe(1);
        expect(attrs.has('data-delete-taps')).toBe(false);
    });
});

// ==================== spreadVideosByArtist ====================
describe('spreadVideosByArtist', () => {
    const v = (id, channelId) => ({ id, channelId });
    const ids = list => list.map(item => item.id).join('');

    it('separa vídeos seguits del mateix artista', () => {
        const out = ctx.spreadVideosByArtist([v('a', 1), v('b', 1), v('c', 2), v('d', 2), v('e', 3)]);
        for (let i = 1; i < out.length; i++) expect(out[i].channelId).not.toBe(out[i - 1].channelId);
        expect(out).toHaveLength(5);
    });

    it('conserva l\'ordre si ja hi ha varietat', () => {
        expect(ids(ctx.spreadVideosByArtist([v('a', 1), v('b', 2), v('c', 3)]))).toBe('abc');
    });

    it('evita repetir l\'artista anterior indicat', () => {
        const out = ctx.spreadVideosByArtist([v('a', 1), v('b', 2)], { previousArtist: '1' });
        expect(ids(out)).toBe('ba');
    });

    it('no falla si tot és del mateix artista', () => {
        expect(ids(ctx.spreadVideosByArtist([v('a', 1), v('b', 1)]))).toBe('ab');
    });

    it('reparteix tongades llargues del mateix artista (arxiu ordenat per data)', () => {
        const list = [];
        // 30 vídeos de A seguits, després 10 de B, 8 de C i 12 més d'artistes diferents
        for (let i = 0; i < 30; i++) list.push(v(`a${i}`, 'A'));
        for (let i = 0; i < 10; i++) list.push(v(`b${i}`, 'B'));
        for (let i = 0; i < 8; i++) list.push(v(`c${i}`, 'C'));
        for (let i = 0; i < 12; i++) list.push(v(`x${i}`, `X${i}`));
        const out = ctx.spreadVideosByArtist(list, { window: 400 });
        expect(out).toHaveLength(list.length);
        const adjacent = out.filter((item, i) => i > 0 && item.channelId === out[i - 1].channelId);
        // A té 30 de 60: l'alternança perfecta és possible, però mai més de 1-2 parelles per l'excés
        expect(adjacent.length).toBeLessThanOrEqual(1);
    });
});

// ==================== limitClassicFrequency ====================
describe('limitClassicFrequency', () => {
    const v = (id, classic) => ({ id, classic });
    const isClassic = video => video.classic;
    const ids = list => list.map(item => item.id).join('');

    it('no deixa més d\'1 antic de cada 5 i conserva l\'ordre de cada grup', () => {
        const list = [v('a1', true), v('a2', true), v('a3', true)];
        for (let i = 1; i <= 8; i++) list.unshift(v('m' + (9 - i), false));
        // moderns m1..m8 (ordre) + antics a1..a3 al final
        const out = ctx.limitClassicFrequency(list, { every: 5, isClassic });
        expect(ids(out)).toBe('m1m2m3m4a1m5m6m7m8a2a3'.replace(/m/g, 'm'));
    });

    it('si no hi ha antics o només n\'hi ha, deixa la llista igual', () => {
        const onlyModern = [v('a', false), v('b', false)];
        expect(ctx.limitClassicFrequency(onlyModern, { isClassic })).toBe(onlyModern);
        const onlyOld = [v('a', true), v('b', true)];
        expect(ctx.limitClassicFrequency(onlyOld, { isClassic })).toBe(onlyOld);
    });

    it('amb every=2 alterna modern i antic', () => {
        const list = [v('m1', false), v('m2', false), v('a1', true), v('a2', true)];
        expect(ids(ctx.limitClassicFrequency(list, { every: 2, isClassic }))).toBe('m1a1m2a2');
    });
});

