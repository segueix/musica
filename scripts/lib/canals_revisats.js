'use strict';

// Una revisió de seleccions/falsos Shorts només necessita consultar els canals afectats.
function canalsRevisats({ abans, despres, shortsAbans, shortsDespres, feed, actuals }) {
    const ids = new Set();
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
        for (const [channelId, rule] of [...Object.entries(rulesBefore), ...Object.entries(rulesAfter)]) {
            if (rule.allowedVideoIds?.includes(videoId)) owners.add(channelId);
        }
        if (!owners.size) throw new Error('No es pot delimitar el canal del fals Short ' + videoId);
        for (const channelId of owners) ids.add(channelId);
    }
    return [...ids].filter(id => actuals.has(id)).sort();
}

module.exports = { canalsRevisats };
