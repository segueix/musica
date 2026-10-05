import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadChannelVideoAllowlist, isChannelVideoAllowed } = require('../scripts/lib/filtre_videos_canal.js');
const parse = channels => loadChannelVideoAllowlist('fixture', {
    readFileSync: () => JSON.stringify({ channels }),
});

describe('gravacions instrumentals seleccionades', () => {
    it('rebutja una versió vocal amb el mateix títol però un altre ID', () => {
        const rules = parse({ canal: { allowedTitles: ['Prelude'], allowedVideoIds: ['4i5sgYI14Jg'] } });
        expect(isChannelVideoAllowed(rules, 'canal', 'Prelude', '4i5sgYI14Jg')).toBe(true);
        expect(isChannelVideoAllowed(rules, 'canal', 'Prelude', 'AAAAAAAAAAA')).toBe(false);
        expect(isChannelVideoAllowed(rules, 'canal', 'Entrevista', '4i5sgYI14Jg')).toBe(false);
    });
    it('una selecció buida o invàlida no obre el canal', () => {
        for (const allowedVideoIds of [[], ['invalid']]) {
            const rules = parse({ canal: { allowedVideoIds } });
            expect(isChannelVideoAllowed(rules, 'canal', 'Prelude', '4i5sgYI14Jg')).toBe(false);
        }
    });
    it('conserva les regles prèvies sense IDs i el bloqueig explícit', () => {
        const rules = parse({ antic: { allowedTitles: ['Bon dia'] }, bloquejat: { blocked: true, allowedVideoIds: ['4i5sgYI14Jg'] } });
        expect(isChannelVideoAllowed(rules, 'antic', 'Bon dia', '4i5sgYI14Jg')).toBe(true);
        expect(isChannelVideoAllowed(rules, 'antic', 'Altres', '4i5sgYI14Jg')).toBe(false);
        expect(isChannelVideoAllowed(rules, 'bloquejat', 'Prelude', '4i5sgYI14Jg')).toBe(false);
    });
});
