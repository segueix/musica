import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EXCLUDED, LYRICS_CA, CHANNEL } = require('../scripts/revisions/revisar_animal_20261013.js');
const { loadChannelVideoAllowlist, isChannelVideoAllowed } = require('../scripts/lib/filtre_videos_canal.js');
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const ids = EXCLUDED.flatMap(w => w.ids);

describe('Exclusions lingüístiques documentades d’Animal', () => {
    it('bloqueja els sis enregistraments, inclosa Bam bam', () => {
        expect(new Set(ids).size).toBe(6);
        const hidden = new Set(read('data/hidden-videos.json').videoIds);
        for (const id of ids) expect(hidden.has(id), id).toBe(true);
    });
    it('la regla persisteix per a les quatre obres del canal', () => {
        const rules = loadChannelVideoAllowlist('data/music-channel-video-allowlist.json');
        for (const work of EXCLUDED) {
            expect(isChannelVideoAllowed(rules, CHANNEL, 'Animal - ' + work.title + ' - #ORIGENANIMAL')).toBe(false);
        }
    });
    it('no bloqueja altres cançons d’Animal ni homònims d’altres artistes', () => {
        const rules = loadChannelVideoAllowlist('data/music-channel-video-allowlist.json');
        expect(isChannelVideoAllowed(rules, CHANNEL, 'Animal - Si tot va bé')).toBe(true);
        expect(isChannelVideoAllowed(rules, CHANNEL, 'Animal - Només amb tu')).toBe(true);
        expect(isChannelVideoAllowed(rules, 'un-altre-canal', 'Bam bam')).toBe(true);
        const hidden = new Set(read('data/hidden-videos.json').videoIds);
        for (const id of LYRICS_CA) expect(hidden.has(id), id).toBe(false);
    });
    it('cada exclusió té una font i una decisió explícita', () => {
        const decisions = read('data/revisio-idiomes.json').decisions;
        for (const id of ids) {
            const decision = decisions.find(d => d.id === id);
            expect(decision?.accio, id).toBe('amaga');
            expect(decision?.font, id).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
        }
    });
    it('els IDs no reapareixen al feed, a l’arxiu, a les ràdios ni a la cerca', () => {
        const files = ['data/feed.json', 'data/history-pool.json', 'data/historial-musical.json',
            ...readdirSync('data/archive/channels').filter(f => f.endsWith('.json')).map(f => 'data/archive/channels/' + f),
            ...readdirSync('data').filter(f => /^search_index_.*\.json$/.test(f)).map(f => 'data/' + f)];
        for (const file of files) {
            const data = readFileSync(file, 'utf8');
            for (const id of ids) expect(data.includes(id), file + ' · ' + id).toBe(false);
        }
        for (const id of ids) expect(existsSync('compartir/canco/' + id + '.html'), id).toBe(false);
    });
});
