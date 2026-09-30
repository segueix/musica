import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const c = createRequire(import.meta.url)('../scripts/lib/cataleg_musical.js');

describe('catàleg musical incremental', () => {
    it('conserva el repertori fora de la finestra: els més populars, fins al límit', () => {
        const previous = [
            { id: 'a', viewCount: 10 },
            { id: 'b', viewCount: 500 },
            { id: 'c', viewCount: 200 },
            { id: 'd', viewCount: 900 },
        ];
        expect(c.pickRetained(previous, ['d'], 2).map(v => v.id)).toEqual(['b', 'c']);
        expect(c.pickRetained(previous, new Set(['a', 'b', 'c', 'd']), 5)).toEqual([]);
    });

    it('només retira un vídeo confirmat com a privat o eliminat', () => {
        expect(c.verdict({ requested: 'a', returned: { status: { privacyStatus: 'public' } } })).toBe('kept');
        expect(c.verdict({ requested: 'a', returned: { status: { privacyStatus: 'private' } } })).toBe('removed');
        expect(c.verdict({ requested: 'a', returned: undefined })).toBe('removed');
        // Fallada transitòria de l'API: no es pot afirmar res, el vídeo es conserva
        expect(c.verdict({ requested: 'a', returned: undefined, batchFailed: true })).toBe('unverified');
    });

    it('les pàgines profundes respecten el pressupost i van en ordre rotatiu', () => {
        const state = {
            A: { next: 'ta', pages: 1, done: false },
            B: { next: 'tb', pages: 3, done: false },
            C: { next: null, pages: 1, done: true },
            D: { next: 'td', pages: 1, done: false },
            E: { next: 'te', pages: 5, done: false },
        };
        const plan = c.planDeepPages(state, ['A', 'B', 'C', 'D', 'E', 'X'], { budget: 2, maxPages: 5 });
        expect(plan.map(p => p.channelId)).toEqual(['A', 'D']);
        expect(c.planDeepPages(state, ['A', 'B'], { budget: 0 })).toEqual([]);
    });

    it('un token caducat reinicia el canal sense perdre res i el límit de pàgines acaba el canal', () => {
        const state = { A: { next: 'ta', pages: 2, done: false } };
        expect(c.applyDeepResult(state, 'A', { ok: false })).toMatchObject({
            next: null,
            pages: 1,
            done: false,
            restart: true,
        });
        const s2 = { A: { next: 't', pages: 4, done: false } };
        expect(c.applyDeepResult(s2, 'A', { ok: true, nextPageToken: 'more' }, { maxPages: 5 })).toMatchObject({
            pages: 5,
            done: true,
        });
        const s3 = { A: { next: 't', pages: 1, done: false } };
        expect(c.applyDeepResult(s3, 'A', { ok: true, nextPageToken: null })).toMatchObject({ done: true });
    });

    it('del repertori antic només se’n conserven les cançons més populars', () => {
        const items = [
            { id: '1', viewCount: 5, contentType: 'song' },
            { id: '2', viewCount: 900, contentType: 'song' },
            { id: '3', viewCount: 999, contentType: 'other' },
            { id: '4', viewCount: 400, contentType: 'live_song' },
            { id: '5', viewCount: 800, contentType: 'review' },
        ];
        expect(c.selectDeepKeep(items, 2)).toEqual(['2', '4']);
    });

    it('registra el token de la primera pàgina sense sobreescriure l’estat existent', () => {
        const state = {};
        c.seedDeepState(state, 'A', 'tok');
        expect(state.A).toEqual({ next: 'tok', pages: 1, done: false });
        state.A.pages = 3;
        c.seedDeepState(state, 'A', 'altre');
        expect(state.A.pages).toBe(3);
        c.seedDeepState(state, 'B', null);
        expect(state.B.done).toBe(true);
    });
});
