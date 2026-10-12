'use strict';

// Una revisió de seleccions/falsos Shorts només necessita consultar els canals afectats.
function canalsRevisats({ abans, despres, shortsAbans, shortsDespres, releasesAbans = {}, releasesDespres = {}, feed, actuals }) {
    const ids = new Set();
    const before = new Map((releasesAbans.releases || []).map(r => [r.id, r]));
    const after = new Map((releasesDespres.releases || []).map(r => [r.id, r]));
    for (const key of new Set([...before.keys(), ...after.keys()])) {
        if (JSON.stringify(before.get(key)) === JSON.stringify(after.get(key))) continue;
        for (const release of [before.get(key), after.get(key)]) {
            for (const id of release?.channelIds || []) ids.add(id);
        }
    }
    const rulesBefore = abans.channels || {};
    const rulesAfter = despres.channels || {};
    for (const id of new Set([...Object.keys(rulesBefore), ...Object.keys(rulesAfter)])) {
        if (JSON.stringify(rulesBefore[id]) !== JSON.stringify(rulesAfter[id])) ids.add(id);
    }
    // Els patrons de títol no permeten delimitar canals amb seguretat.
    if (JSON.stringify(shortsAbans.falseShortTitleContains || []) !==
        JSON.stringify(shortsDespres.falseShortTitleContains || [])) {
        throw new Error('Canvi de patrons de Shorts: cal una actualització general manual.');
    }
    const oldShorts = new Set(shortsAbans.falseShorts || []);
    const newShorts = new Set(shortsDespres.falseShorts || []);
    for (const videoId of new Set([...oldShorts, ...newShorts])) {
        if (oldShorts.has(videoId) === newShorts.has(videoId)) continue;
        const owners = new Set((feed.videos || []).filter(v => v.id === videoId).map(v => v.channelId));
        for (const registry of [shortsAbans, shortsDespres]) {
            const owner = registry.falseShortChannels?.[videoId];
            if (typeof owner === 'string' && actuals.has(owner)) owners.add(owner);
        }
        for (const [channelId, rule] of [...Object.entries(rulesBefore), ...Object.entries(rulesAfter)]) {
            if (rule.allowedVideoIds?.includes(videoId)) owners.add(channelId);
        }
        if (!owners.size) throw new Error('No es pot delimitar el canal del fals Short ' + videoId);
        for (const channelId of owners) ids.add(channelId);
    }
    return [...ids].filter(id => actuals.has(id)).sort();
}

module.exports = { canalsRevisats };
