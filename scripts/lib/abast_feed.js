'use strict';

// Què ha de fer el workflow «Actualitzar feed musical» en cada execució (lògica pura; el workflow només hi passa
// l'esdeveniment i les dades). Objectiu: no gastar quota de YouTube si no cal (2026-10-06).
//
//  - schedule:           actualització general, NOMÉS a les 20 h de Madrid. GitHub no entén zones horàries: hi ha
//                        dos crons (18 h UTC a l'estiu, 19 h UTC a l'hivern) i aquí es descarta el que no toca.
//  - workflow_run:       altes i seleccions del commit validat → només aquests canals; baixes sense API.
//  - push:               revisions de dades (seleccions de canal, falsos Shorts) → només els canals afectats.
//  - workflow_dispatch:  actualització general (manual).

const GENERAL_HOUR = 20;
const TIME_ZONE = 'Europe/Madrid';
const SCHEDULES = { summer: '0 18 * * *', winter: '0 19 * * *' };

// Diferència en hores entre Madrid i UTC en aquell moment (1 a l'hivern, 2 a l'estiu).
function madridOffsetHours(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const local = Number(parts.find(part => part.type === 'hour')?.value);
    return (((local - date.getUTCHours()) % 24) + 24) % 24;
}

// El cron que correspon a les 20 h de Madrid el dia `date`.
function generalSchedule(date = new Date()) {
    const utcHour = (((GENERAL_HOUR - madridOffsetHours(date)) % 24) + 24) % 24;
    return `0 ${utcHour} * * *`;
}

function decideScope({ event, schedule = '', now = new Date(), added = [], removed = [], reviewed = [] } = {}) {
    const ids = list => [...new Set(list || [])].sort();
    const base = { work: false, runApi: false, targetIds: [], removed: ids(removed) };

    if (event === 'workflow_dispatch') {
        return { ...base, work: true, runApi: true, message: '🔄 Execució manual: actualització general.' };
    }
    if (event === 'schedule') {
        const expected = generalSchedule(now);
        if (schedule && schedule !== expected) {
            return {
                ...base,
                message: `⏭️ El cron «${schedule}» no és el de les ${GENERAL_HOUR} h de Madrid avui («${expected}»): no es fa res.`,
            };
        }
        return {
            ...base,
            work: true,
            runApi: true,
            message: `🔄 Actualització general diària (${GENERAL_HOUR} h de Madrid).`,
        };
    }
    if (event === 'workflow_run') {
        const targetIds = ids([...added, ...reviewed]);
        const purge = base.removed.length > 0;
        const runApi = targetIds.length > 0;
        const parts = [];
        if (runApi) parts.push('🆕 Canals nous o revisats (només aquests a YouTube): ' + targetIds.join(', '));
        if (purge) parts.push('🗑️ Canals de baixa (es treuen sense API): ' + base.removed.join(', '));
        return {
            ...base,
            work: runApi || purge,
            runApi,
            targetIds,
            message: parts.join('\n') || '✅ Sense altes ni baixes de canals: no es gastarà quota de YouTube.',
        };
    }
    if (event === 'push') {
        const targetIds = ids(reviewed);
        return {
            ...base,
            work: targetIds.length > 0,
            runApi: targetIds.length > 0,
            targetIds,
            message: targetIds.length
                ? 'Canals amb seleccions revisades: ' + targetIds.join(', ')
                : 'Cap canal amb seleccions revisades: no es consulta YouTube (els canvis de codi esperen a les 20 h).',
        };
    }
    return { ...base, message: `Esdeveniment desconegut (${event}): no es fa res.` };
}

module.exports = { GENERAL_HOUR, SCHEDULES, madridOffsetHours, generalSchedule, decideScope };
