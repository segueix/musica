'use strict';

// Política vigent (2026-10-14): el catàleg només s'actualitza en l'horari programat o per petició manual.
// Les altes, baixes i seleccions de qualsevol push/workflow_run esperen al torn diari.

const GENERAL_HOUR = 20;
const TIME_ZONE = 'Europe/Madrid';
const SCHEDULES = { local: '0 20 * * *' };

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

// Un sol cron amb timezone: Europe/Madrid; no cal engegar dos runners i descartar-ne un.
function generalSchedule() {
    return SCHEDULES.local;
}

function decideScope({ event, schedule = '', removed = [] } = {}) {
    const base = { work: false, runApi: false, targetIds: [], removed: [...new Set(removed || [])].sort() };
    if (event === 'workflow_dispatch') {
        return { ...base, work: true, runApi: true, message: 'Execució manual expressa: actualització general.' };
    }
    if (event === 'schedule' && schedule === generalSchedule()) {
        return { ...base, work: true, runApi: true, message: 'Actualització diària programada a les 20 h (Europe/Madrid).' };
    }
    return { ...base, message: 'No es consulta YouTube: els canvis de grups i revisions esperen al torn diari.' };
}

module.exports = { GENERAL_HOUR, SCHEDULES, madridOffsetHours, generalSchedule, decideScope };
