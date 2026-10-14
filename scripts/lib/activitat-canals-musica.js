'use strict';

// Freqüència de consulta, mai filtre de visibilitat. No deduïm l'activitat del feed
// musical: ja ha exclòs idiomes, Shorts i altres publicacions del canal.
const fs = require('node:fs');
const path = require('node:path');
const DAY = 86400000;
const STATE_FILE = 'music-channel-polling.json';
const TIME_ZONE = 'Europe/Madrid';

function dateKey(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}
function dayNumber(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return NaN;
    const ms = Date.parse(key + 'T00:00:00Z');
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === key ? ms / DAY : NaN;
}
function validPublication(value, now) {
    const ms = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(ms) && ms > 0 && ms <= now.getTime() ? new Date(ms).toISOString() : null;
}
function yearsBefore(key, years) {
    const [year, month, day] = key.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year - years, month, 0)).getUTCDate();
    return new Date(Date.UTC(year - years, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}
function intervalDays(latest, now = new Date()) {
    const valid = validPublication(latest, now);
    if (!valid) return 1; // Desconegut no vol dir inactiu.
    const published = dateKey(new Date(valid)), today = dateKey(now);
    if (published > yearsBefore(today, 1)) return 1;
    return published < yearsBefore(today, 3) ? 7 : 3;
}
function isDue(entry, now = new Date()) {
    if (!entry || !validPublication(entry.lastCheckedAt, now)) return true;
    const next = dayNumber(entry.nextCheckOn);
    return !Number.isFinite(next) || next <= dayNumber(dateKey(now));
}
function latestPublication(items, now = new Date()) {
    return (items || [])
        .filter(item => !item.status?.privacyStatus || item.status.privacyStatus === 'public')
        .map(item => validPublication(item.contentDetails?.videoPublishedAt, now))
        .filter(Boolean).sort().at(-1) || null;
}
function fullTopicDue(entry, now, days = 7) {
    if (!validPublication(entry?.lastFullTopicAt, now)) return true;
    return dayNumber(dateKey(now)) - dayNumber(dateKey(new Date(entry.lastFullTopicAt))) >= days;
}
function recordSuccess(state, id, { latestPublishedAt, fullTopic = false }, now) {
    const latest = validPublication(latestPublishedAt, now);
    const days = intervalDays(latest, now);
    state.channels[id] = {
        ...state.channels[id], latestPublishedAt: latest, lastCheckedAt: now.toISOString(), intervalDays: days,
        nextCheckOn: new Date((dayNumber(dateKey(now)) + days) * DAY).toISOString().slice(0, 10),
    };
    if (fullTopic) state.channels[id].lastFullTopicAt = now.toISOString();
}
function loadState(root) {
    const file = path.join(root, 'data', STATE_FILE);
    if (!fs.existsSync(file)) return { version: 1, channels: {} };
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (state.version !== 1 || !state.channels || typeof state.channels !== 'object' || Array.isArray(state.channels)) {
        throw new Error('Registre de consulta musical invàlid; no es modifica el catàleg.');
    }
    return state;
}
function saveState(root, state, activeIds, now, summary) {
    state.channels = Object.fromEntries(Object.entries(state.channels).filter(([id]) => activeIds.has(id)));
    state.updatedAt = now.toISOString();
    state.lastRun = summary;
    const file = path.join(root, 'data', STATE_FILE);
    fs.writeFileSync(file + '.tmp', JSON.stringify(state, null, 2) + '\n');
    fs.renameSync(file + '.tmp', file);
}

module.exports = { STATE_FILE, dateKey, dayNumber, intervalDays, isDue, latestPublication, fullTopicDue,
    recordSuccess, loadState, saveState };
