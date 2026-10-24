'use strict';

// Llista d'èxits setmanal (2026-10-22): les cançons en català que més visualitzacions han guanyat a YouTube en una
// setmana. No consulta YouTube: compara les visualitzacions que ja desa el feed diari amb la fotografia de la setmana
// anterior. Cada canal es consulta cada 1, 3 o 7 dies (docs/CONSULTES_PER_ACTIVITAT.md), per això el creixement es
// calcula amb l'hora real de cada lectura (`lastCheckedAt` de data/music-channel-polling.json) i es porta a set dies.
// Funcions pures; el fitxer d'entrada és scripts/generar_llista_exits.js. Detall: docs/LLISTA_EXITS.md.

const { songKey } = require('./canal_tema.js');

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const TIME_ZONE = 'Europe/Madrid';
const CHART_SIZE = 40;
const PER_ARTIST = 3; // cap artista no hi pot posar més de tres cançons
const MIN_GROWTH = 100; // visualitzacions setmanals mínimes per entrar a la llista
const MIN_SPAN = DAY; // dues lectures separades menys d'un dia no diuen res del creixement
const SCALE_LIMITS = [0.5, 2]; // una lectura de 3,5 a 14 dies es porta a set dies, no més
const PUBLISH_WEEKDAY = 0; // diumenge a la tarda (acció «Llista d'èxits setmanal»), en tancar la setmana
const HISTORY_WEEKS = 26;
// La música infantil se sent en bucle (els pares la deixen sonar) i ompliria la llista: no hi entra.
const EXCLUDED_CATEGORIES = ['Infantil'];

const stamp = value => Date.parse(String(value || '')) || 0;
const views = video => Math.max(0, Number(video?.viewCount) || 0);

// Data local de Madrid (AAAA-MM-DD) i dia de la setmana (0 = diumenge).
function madridDate(time) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    }).formatToParts(new Date(time));
    const get = type => parts.find(part => part.type === type)?.value;
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday };
}

// Toca publicar: la primera vegada, cada diumenge (si fa almenys cinc dies de l'anterior) o, si un diumenge no
// s'ha pogut fer, en passar-ne vuit.
function shouldPublish({ now = Date.now(), lastAt = null } = {}) {
    const last = stamp(lastAt);
    if (!last) return true;
    const elapsed = now - last;
    if (elapsed >= 8 * DAY) return true;
    return elapsed >= 5 * DAY && madridDate(now).weekday === PUBLISH_WEEKDAY;
}

// Setmana de la llista, de dilluns a diumenge (2026-10-24). Es mira el dia anterior: el diumenge a la tarda i
// qualsevol dia entre setmana donen la setmana en curs; un dilluns (un diumenge que no s'ha pogut fer), la que
// acaba de tancar.
function chartWeek(now = Date.now()) {
    const { date, weekday } = madridDate(now - DAY);
    const [year, month, day] = date.split('-').map(Number);
    const monday = Date.UTC(year, month - 1, day - ((weekday + 6) % 7));
    const iso = time => new Date(time).toISOString().slice(0, 10);
    return { from: iso(monday), to: iso(monday + 6 * DAY) };
}

// Fotografia de les visualitzacions: { id: [visualitzacions, segons de la lectura] }. L'hora és la de l'última
// consulta del canal; sense, la de la generació del feed.
function takeSnapshot(feed, polling, now = Date.now()) {
    const fallback = stamp(feed?.generatedAt) || now;
    const checked = new Map(
        Object.entries(polling?.channels || {}).map(([id, entry]) => [id, stamp(entry?.lastCheckedAt)])
    );
    const videos = {};
    for (const video of Array.isArray(feed?.videos) ? feed.videos : []) {
        if (!video?.id || !Number.isFinite(Number(video.viewCount))) continue;
        const at = checked.get(String(video.channelId)) || fallback;
        videos[video.id] = [views(video), Math.round(Math.min(at, now) / 1000)];
    }
    // L'hora de la fotografia és la del feed: una cançó publicada després ja és una estrena de la setmana següent
    return { takenAt: new Date(Math.min(fallback, now)).toISOString(), videos };
}

// Visualitzacions guanyades en una setmana. `null` si no se'n sap res (canal no tornat a consultar, cançó que no hi
// era i que no s'ha publicat aquesta setmana).
function weeklyGrowth({ now, base, baseTakenAt, publishedAt }) {
    if (!now) return null;
    const [current, currentAt] = now;
    if (!base) {
        // Estrena de la setmana: compten totes les seves visualitzacions
        const published = stamp(publishedAt);
        return published && published >= stamp(baseTakenAt) ? { growth: current, isRelease: true } : null;
    }
    const [before, beforeAt] = base;
    const span = (currentAt - beforeAt) * 1000;
    if (span < MIN_SPAN) return null;
    const scale = Math.min(SCALE_LIMITS[1], Math.max(SCALE_LIMITS[0], WEEK / span));
    return { growth: Math.round(Math.max(0, current - before) * scale), isRelease: false };
}

// `songs`: cançons del catàleg públic amb `artistId` i `artist` (nom que es veu a l'app). El videoclip, la pista del
// «Tema» i els directes d'una mateixa cançó d'un artista sumen junts; la representa la versió que més ha crescut.
function buildChart({ songs, current, base, previous = null, history = {}, now = Date.now() } = {}) {
    const groups = new Map();
    for (const song of Array.isArray(songs) ? songs : []) {
        if ((song.categories || []).some(category => EXCLUDED_CATEGORIES.includes(category))) continue;
        const result = weeklyGrowth({
            now: current?.videos?.[song.id],
            base: base?.videos?.[song.id],
            baseTakenAt: base?.takenAt,
            publishedAt: song.publishedAt,
        });
        if (!result) continue;
        const key = `${song.artistId}|${songKey(song.title, [song.artist]) || song.id}`;
        const group = groups.get(key) || { key, growth: 0, views: 0, best: null, bestGrowth: -1, isRelease: true };
        group.growth += result.growth;
        group.views += views(song);
        group.isRelease = group.isRelease && result.isRelease;
        if (result.growth > group.bestGrowth) {
            group.best = song;
            group.bestGrowth = result.growth;
        }
        groups.set(key, group);
    }
    const perArtist = new Map();
    const ranked = [...groups.values()]
        .filter(group => group.growth >= MIN_GROWTH)
        .sort((a, b) => b.growth - a.growth || b.views - a.views || String(a.best.id).localeCompare(String(b.best.id)))
        .filter(group => {
            const count = perArtist.get(group.best.artistId) || 0;
            if (count >= PER_ARTIST) return false;
            perArtist.set(group.best.artistId, count + 1);
            return true;
        })
        .slice(0, CHART_SIZE);

    const lastRank = new Map((previous?.entries || []).map(entry => [entry.key, entry.rank]));
    const nextHistory = {};
    const cutoff = now - HISTORY_WEEKS * WEEK;
    for (const [key, item] of Object.entries(history || {})) {
        if (stamp(item?.lastAt) >= cutoff) nextHistory[key] = item;
    }
    const at = new Date(now).toISOString();
    const entries = ranked.map((group, index) => {
        const rank = index + 1;
        const past = nextHistory[group.key];
        const previousRank = lastRank.get(group.key) ?? null;
        const status = !past
            ? 'new'
            : previousRank == null
              ? 'back'
              : rank < previousRank
                ? 'up'
                : rank > previousRank
                  ? 'down'
                  : 'same';
        const peak = Math.min(rank, past?.peak || rank);
        const weeks = (past?.weeks || 0) + 1;
        nextHistory[group.key] = { peak, weeks, lastAt: at };
        return {
            rank,
            previous: previousRank,
            status,
            peak,
            weeks,
            growth: group.growth,
            key: group.key,
            video: publicVideo(group.best),
        };
    });
    return {
        chart: {
            version: 1,
            generatedAt: at,
            // Primera edició: encara no hi ha moviments per mostrar
            first: !previous,
            ...chartWeek(now),
            size: entries.length,
            entries,
        },
        history: nextHistory,
    };
}

// Les dades que el client necessita per pintar i fer sonar la cançó encara que no sigui al seu feed.
function publicVideo(song) {
    const out = {
        id: song.id,
        title: song.title,
        channelId: song.channelId,
        channelTitle: song.artist,
        thumbnail: song.thumbnail || `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`,
        publishedAt: song.publishedAt,
        durationSeconds: Number(song.durationSeconds) || undefined,
        viewCount: views(song),
        categories: Array.isArray(song.categories) ? song.categories : [],
        contentType: song.contentType || 'song',
    };
    if (song.originalYear) out.originalYear = song.originalYear;
    return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined));
}

// Una entrada per línia (com el feed): els canals setmanals donen diffs llegibles.
function serializeChart(chart) {
    const { entries, ...head } = chart;
    const lines = entries.map(entry => '    ' + JSON.stringify(entry));
    const top = JSON.stringify(head, null, 2).replace(/\n}$/, '');
    return `${top},\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

function serializeBase(base) {
    const ids = Object.keys(base.videos || {}).sort();
    const lines = ids.map(id => `    ${JSON.stringify(id)}: ${JSON.stringify(base.videos[id])}`);
    const history = Object.keys(base.history || {})
        .sort()
        .map(key => `    ${JSON.stringify(key)}: ${JSON.stringify(base.history[key])}`);
    return (
        `{\n  "version": 1,\n  "takenAt": ${JSON.stringify(base.takenAt)},\n  "chartAt": ${JSON.stringify(base.chartAt || null)},\n` +
        `  "history": {\n${history.join(',\n')}\n  },\n  "videos": {\n${lines.join(',\n')}\n  }\n}\n`
    );
}

module.exports = {
    CHART_SIZE,
    EXCLUDED_CATEGORIES,
    PER_ARTIST,
    MIN_GROWTH,
    madridDate,
    chartWeek,
    shouldPublish,
    takeSnapshot,
    weeklyGrowth,
    buildChart,
    publicVideo,
    serializeChart,
    serializeBase,
};
