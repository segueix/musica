import { describe, expect, it } from 'vitest';
import { createMockLocalStorage, loadScript } from './setup.js';

const S = loadScript('js/features/music-signals.js', { localStorage: createMockLocalStorage() }).SegueixApp.features
    .musicSignals;
const MIN = 60000;

// Reproductor simulat: un rellotge injectat i un tracker sense DOM.
function rig(video = { id: 'vid00000001', channelId: 'artA', durationSeconds: 200, contentType: 'song' }) {
    let clock = 1_800_000_000_000;
    const saved = [];
    const tracker = S.createTracker({
        now: () => clock,
        load: () => null,
        save: stats => saved.push(JSON.stringify(stats)),
        saveDelay: 0,
        resolveVideo: id =>
            id === video.id ? video : { id, channelId: 'artB', durationSeconds: 200, contentType: 'song' },
        artistKeyOf: v => v.channelId,
        isSong: () => true,
    });
    const api = {
        tracker,
        video,
        get clock() {
            return clock;
        },
        advance(ms) {
            clock += ms;
        },
        // Reprodueix `seconds` amb un missatge cada segon (com infoDelivery), començant a `from`.
        play(id, seconds, { from = 0, state = 1, duration = 200 } = {}) {
            tracker.onPlayerEvent({ videoId: id, state, position: from, duration });
            for (let i = 1; i <= seconds; i++) {
                clock += 1000;
                tracker.onPlayerEvent({ videoId: id, state, position: from + i, duration });
            }
        },
        stats: () => tracker.getStats(),
    };
    return api;
}

describe('progrés efectiu del reproductor', () => {
    it('només suma temps que avança de debò amb el reproductor en marxa', () => {
        const session = S.newSession({ id: 'a', artist: 'x', origin: 'user', now: 1, duration: 200 });
        S.addProgress(session, 0, 1);
        expect(S.addProgress(session, 1, 1)).toBe(1);
        expect(S.addProgress(session, 2, 2)).toBe(0); // pausa
        expect(S.addProgress(session, 3, 3)).toBe(0); // buffering / xarxa
        expect(S.addProgress(session, 90, 1)).toBe(0); // seek endavant
        expect(S.addProgress(session, 10, 1)).toBe(0); // seek enrere
        expect(S.addProgress(session, 11, 1)).toBe(1);
        expect(session.played).toBe(2);
    });
});

describe('escoltes qualificades i finalitzacions', () => {
    it('una escolta qualificada requereix 30 s; una finalització, el 85 %', () => {
        const r = rig();
        r.play('vid00000001', 29);
        expect(r.stats().songs.vid00000001?.q || 0).toBe(0);
        r.play('vid00000001', 2, { from: 29 });
        expect(r.stats().songs.vid00000001.q).toBe(1);
        expect(r.stats().songs.vid00000001.f || 0).toBe(0);
        r.play('vid00000001', 140, { from: 31 });
        expect(r.stats().songs.vid00000001.f).toBe(1);
        expect(r.stats().artists.artA).toMatchObject({ q: 1, f: 1 });
    });

    it('el llindar és proporcional en peces curtes', () => {
        const r = rig({ id: 'short0000001', channelId: 'artA', durationSeconds: 40, contentType: 'song' });
        r.play('short0000001', 21, { duration: 40 });
        expect(r.stats().songs.short0000001.q).toBe(1);
    });

    it('comptar dues vegades la mateixa sessió no és possible (identificador de sessió)', () => {
        const r = rig();
        r.play('vid00000001', 60);
        r.play('vid00000001', 5, { from: 60 });
        r.play('vid00000001', 5, { from: 65 });
        expect(r.stats().songs.vid00000001.q).toBe(1);
        expect(r.tracker.session.sid).toMatch(/^1:vid00000001:/);
    });

    it('un bucle automàtic no amplifica el gust: la finestra de repetició és de 30 min', () => {
        const r = rig();
        r.play('vid00000001', 190, { from: 0 });
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 0 });
        // La mateixa cançó torna a sonar de seguida (bucle)
        r.play('vid00000001', 190, { from: 0 });
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 0 });
        expect(r.stats().songs.vid00000001.q).toBe(1);
        expect(r.stats().songs.vid00000001.f).toBe(1);
        expect(r.stats().songs.vid00000001.r || 0).toBe(0);
    });

    it('tornar a triar voluntàriament una cançó ja escoltada compta com a repetició (més fort)', () => {
        const r = rig();
        r.play('vid00000001', 100);
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 2 });
        r.tracker.flush();
        r.advance(45 * MIN);
        // L'usuari la torna a triar (no ve d'una cançó que acaba ni d'un «següent»)
        r.play('vid00000001', 100);
        expect(r.stats().songs.vid00000001.q).toBe(2);
        expect(r.stats().songs.vid00000001.r).toBe(1);
        expect(r.stats().artists.artA.r).toBe(1);
    });

    it('una cançó triada per la ràdio (després d’acabar l’anterior) no és una repetició voluntària', () => {
        const r = rig();
        r.play('vid00000001', 100);
        r.tracker.flush();
        r.advance(45 * MIN);
        r.play('other0000001', 195);
        r.tracker.onPlayerEvent({ videoId: 'other0000001', state: 0 });
        r.advance(2000);
        r.play('vid00000001', 100); // la ràdio la torna a programar just després
        expect(r.stats().songs.vid00000001.q).toBe(2);
        expect(r.stats().songs.vid00000001.r || 0).toBe(0);
    });
});

describe('el que NO és escolta ni rebuig', () => {
    it('obrir una pàgina o cercar sense reproducció no crea cap estadística', () => {
        const r = rig();
        r.tracker.onPlayerEvent({ videoId: 'vid00000001' });
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 3 });
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 5 });
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: -1 });
        r.tracker.flush();
        expect(r.stats().songs).toEqual({});
    });

    it('pausa, seek, fallada de xarxa i autoplay bloquejat no generen escoltes ni salts', () => {
        const r = rig();
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 1, position: 0, duration: 200 });
        for (let i = 1; i <= 10; i++) {
            r.advance(1000);
            r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 1, position: i, duration: 200 });
        }
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 2, position: 10 }); // pausa
        r.advance(20 * MIN);
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 2, position: 10 });
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 1, position: 150 }); // seek
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: 3, position: 150 }); // xarxa
        r.tracker.onPlayerEvent({ videoId: 'vid00000001', state: -1 }); // error / autoplay bloquejat
        r.tracker.flush();
        const song = r.stats().songs.vid00000001;
        expect(song?.q || 0).toBe(0);
        expect(song?.s || 0).toBe(0);
    });

    it('canviar de pàgina (pagehide) tanca la sessió sense comptar-la com a rebuig', () => {
        const r = rig();
        r.play('vid00000001', 12);
        r.tracker.flush();
        expect(r.stats().songs.vid00000001?.s || 0).toBe(0);
    });
});

describe('salts manuals ràpids', () => {
    it('un salt manual abans de 20 s suma un salt; un després d’escoltar-la no', () => {
        const r = rig();
        r.play('vid00000001', 8);
        r.tracker.onUserAction('next');
        r.play('vid00000002', 5);
        expect(r.stats().songs.vid00000001.s).toBe(1);
        expect(r.stats().artists.artA.s).toBe(1);

        const late = rig();
        late.play('vid00000001', 90);
        late.tracker.onUserAction('next');
        late.play('vid00000002', 3);
        expect(late.stats().songs.vid00000001.s || 0).toBe(0);
    });

    it('sense acció de l’usuari (canvi automàtic de vídeo) no hi ha salt', () => {
        const r = rig();
        r.play('vid00000001', 8);
        r.play('vid00000002', 5);
        expect(r.stats().songs.vid00000001?.s || 0).toBe(0);
    });

    it('el rebuig és temporal: el penalitza el motor amb decaïment (no es desa com a etiqueta)', () => {
        const r = rig();
        r.play('vid00000001', 5);
        r.tracker.onUserAction('next');
        r.tracker.flush();
        const entry = r.stats().songs.vid00000001;
        expect(entry).toHaveProperty('sl');
        expect(entry).not.toHaveProperty('dislike');
    });
});

describe('contingut que no és cançó', () => {
    it('no toca les estadístiques', () => {
        let clock = 1e12;
        const tracker = S.createTracker({
            now: () => clock,
            saveDelay: 0,
            resolveVideo: () => ({ id: 'z', channelId: 'artZ', contentType: 'other' }),
            isSong: () => false,
            allowNonSong: () => false,
        });
        tracker.onPlayerEvent({ videoId: 'zzzzzzzzzzz', state: 1, position: 0, duration: 200 });
        for (let i = 1; i < 100; i++) {
            clock += 1000;
            tracker.onPlayerEvent({ videoId: 'zzzzzzzzzzz', state: 1, position: i, duration: 200 });
        }
        expect(tracker.getStats().songs).toEqual({});
    });
});

describe('fusió, límits i migració', () => {
    it('importar dues vegades les mateixes estadístiques no les suma', () => {
        const a = {
            songs: { x: { q: 3, f: 2, r: 1, l: 100 } },
            artists: { y: { q: 3, l: 100, m: { '2026-09': 3 } } },
            recent: [{ id: 'x', at: 100 }],
        };
        const merged = S.mergeStats(S.mergeStats(null, a), a);
        expect(merged.songs.x).toMatchObject({ q: 3, f: 2, r: 1 });
        expect(merged.artists.y.m['2026-09']).toBe(3);
        expect(merged.recent).toHaveLength(1);
    });

    it('la fusió conserva el màxim de cada costat', () => {
        const local = { songs: { x: { q: 5, l: 200 } }, artists: {}, recent: [] };
        const incoming = { songs: { x: { q: 2, f: 4, l: 500 }, w: { q: 1 } }, artists: {}, recent: [] };
        const merged = S.mergeStats(local, incoming);
        expect(merged.songs.x).toMatchObject({ q: 5, f: 4, l: 500 });
        expect(merged.songs.w.q).toBe(1);
    });

    it('la mida està acotada per cançons, artistes i mesos', () => {
        const stats = { songs: {}, artists: {}, recent: [] };
        for (let i = 0; i < S.LIMITS.songs + 300; i++) stats.songs[`s${i}`] = { q: 1 + (i % 7), l: i };
        for (let i = 0; i < S.LIMITS.artists + 100; i++) stats.artists[`a${i}`] = { q: 1 + (i % 5), l: i };
        stats.artists.a5.m = Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => [`2024-${String((i % 12) + 1).padStart(2, '0')}-${i}`, 1])
        );
        stats.recent = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, at: i }));
        S.trimStats(stats);
        expect(Object.keys(stats.songs).length).toBe(S.LIMITS.songs);
        expect(Object.keys(stats.artists).length).toBeLessThanOrEqual(S.LIMITS.artists);
        expect(stats.recent.length).toBe(S.LIMITS.recent);
        expect(Object.keys(stats.artists.a5?.m || {}).length).toBeLessThanOrEqual(S.LIMITS.months);
    });

    it('els registres antics (historial) són informació feble: cap escolta ni durada inventades', () => {
        const snap = S.buildSnapshot({
            stats: { songs: {}, artists: {}, recent: [] },
            prefs: { lessLike: {}, blocked: {} },
            history: [{ id: 'old00000001', channelId: 'artA', viewedAt: '2026-01-02T10:00:00Z' }],
            liked: [{ id: 'like0000001', channelId: 'artB' }],
            followedIds: ['ARTC'],
            artistKeyOf: v => String(v.channelId || '').toLowerCase(),
            sessionStyles: {},
        });
        expect(snap.songs.old00000001).toEqual({ h: 1, l: Date.parse('2026-01-02T10:00:00Z') });
        expect(snap.songs.old00000001.q).toBeUndefined();
        expect(snap.artists.arta).toEqual({ h: 1 });
        expect(snap.liked.has('like0000001')).toBe(true);
        expect(snap.likedArtists.artb).toBe(1);
        expect(snap.followed.has('artc')).toBe(true);
    });

    it('cors, seguiments i historial sobreviuen: el snapshot no els esborra ni els compta com escoltes', () => {
        const stats = { songs: { x: { q: 4, f: 3, r: 2, l: 10 } }, artists: { a: { q: 4 } }, recent: [] };
        const snap = S.buildSnapshot({
            stats,
            prefs: { lessLike: {}, blocked: {} },
            history: [{ id: 'x', channelId: 'a', viewedAt: '2026-01-01T00:00:00Z' }],
            liked: [],
            followedIds: [],
            artistKeyOf: v => String(v.channelId || ''),
        });
        expect(snap.songs.x).toMatchObject({ q: 4, f: 3, r: 2 });
        expect(snap.songs.x.h).toBe(1);
        expect(snap.artists.a).toMatchObject({ q: 4, h: 1 });
        // L'historial no modifica les estadístiques reals
        expect(stats.songs.x.h).toBeUndefined();
    });
});

describe('preferències explícites', () => {
    it('són reversibles: guanya l’entrada més recent (també en sincronitzar)', () => {
        const a = { lessLike: { x: { at: 10, on: true } }, blocked: {} };
        const b = { lessLike: { x: { at: 20, on: false } }, blocked: { art: { at: 5, on: true } } };
        const merged = S.mergePrefs(a, b);
        expect(merged.lessLike.x.on).toBe(false);
        expect(merged.blocked.art.on).toBe(true);
        expect(S.mergePrefs(merged, a).lessLike.x.on).toBe(false);
    });

    it('«+ com aquesta» es reflecteix al snapshot (cançó, artista i estil) i és excloent amb «−»', () => {
        const snap = S.buildSnapshot({
            stats: { songs: { s1: { a: 'artA', q: 1 } }, artists: {}, recent: [] },
            prefs: { lessLike: {}, moreLike: { s1: { at: 1, on: true }, s2: { at: 1, on: false } }, blocked: {} },
            history: [],
            liked: [],
            followedIds: [],
            artistKeyOf: v => String(v.channelId || ''),
            stylesOf: () => ['pop'],
            videoById: id => ({ id, channelId: 'artA' }),
        });
        expect(snap.moreLike.has('s1')).toBe(true);
        expect(snap.moreLike.has('s2')).toBe(false);
        expect(snap.artists.artA.ml).toBe(1);
        expect(snap.styles.pop).toBeGreaterThanOrEqual(2);
        const merged = S.mergePrefs(
            { lessLike: {}, moreLike: { x: { at: 5, on: true } }, blocked: {} },
            { lessLike: {}, moreLike: { x: { at: 9, on: false } }, blocked: {} }
        );
        expect(merged.moreLike.x.on).toBe(false);
    });

    it('«menys com aquesta» i «no em recomanis» es reflecteixen al snapshot', () => {
        const snap = S.buildSnapshot({
            stats: { songs: { s1: { a: 'artA', q: 1 } }, artists: {}, recent: [] },
            prefs: {
                lessLike: { s1: { at: 1, on: true }, s2: { at: 1, on: false } },
                blocked: { artz: { at: 1, on: true } },
            },
            history: [],
            liked: [],
            followedIds: [],
            artistKeyOf: v => String(v.channelId || ''),
        });
        expect(snap.lessLike.has('s1')).toBe(true);
        expect(snap.lessLike.has('s2')).toBe(false);
        expect(snap.blockedArtists.has('artz')).toBe(true);
        expect(snap.artists.artA.ll).toBe(1);
    });
});
