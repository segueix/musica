import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

// Quota de YouTube del feed musical (2026-10-06): baixes sense API, canals Tema per torns, publicació amb rebase i
// actualització general només a les 20 h de Madrid.
const require = createRequire(import.meta.url);
const tema = require('../scripts/lib/canal_tema.js');
const { activeChannelIds, removedChannelIds, purgeChannels } = require('../scripts/lib/purga_canals.js');
const { decideScope, generalSchedule, madridOffsetHours } = require('../scripts/lib/abast_feed.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const id = n => 'UC' + String(n).padStart(22, 'a');

describe('canals Tema: discografia sencera per torns', () => {
    const ids = Array.from({ length: 280 }, (_, i) => id(i));

    it('cada canal té un torn fix i cada dia en toca aproximadament una setena part', () => {
        expect(tema.topicReadTurn(ids[5])).toBe(tema.topicReadTurn(ids[5]));
        const perTurn = Array(7).fill(0);
        ids.forEach(channel => perTurn[tema.topicReadTurn(channel, 7)]++);
        expect(perTurn.reduce((a, b) => a + b, 0)).toBe(ids.length);
        for (const count of perTurn) expect(count).toBeGreaterThan(ids.length / 7 / 3);
    });

    it('en una setmana cada canal es llegeix sencer exactament un dia', () => {
        const start = Date.parse('2026-10-05T19:00:00Z');
        for (const channel of ids.slice(0, 40)) {
            const days = Array.from({ length: 7 }, (_, d) =>
                tema.shouldReadFullTopic(channel, { date: new Date(start + d * 86400000), days: 7 })
            );
            expect(days.filter(Boolean)).toHaveLength(1);
        }
    });

    it('sense catàleg desat (canal nou) o forçat, es llegeix sencer', () => {
        const date = new Date('2026-10-06T18:00:00Z');
        const notToday = ids.find(channel => !tema.shouldReadFullTopic(channel, { date }));
        expect(tema.shouldReadFullTopic(notToday, { date, hasCatalog: false })).toBe(true);
        expect(tema.shouldReadFullTopic(notToday, { date, force: true })).toBe(true);
    });

    it('la primera pàgina mana i s’hi afegeix la discografia desada, sense repetits', () => {
        const merged = tema.mergeTopicTracks(
            [
                { id: 'nou', title: 'Cançó nova' },
                { id: 'a', title: 'A (títol nou)' },
            ],
            [
                ['a', 'A'],
                ['b', 'B'],
            ]
        );
        expect(merged).toEqual([
            { id: 'nou', title: 'Cançó nova' },
            { id: 'a', title: 'A (títol nou)' },
            { id: 'b', title: 'B' },
        ]);
    });

    it('update_music_feed.js només llegeix la primera pàgina fora del torn i conserva el que ja tenia', () => {
        const source = read('scripts/update_music_feed.js');
        expect(source).toContain('polling.fullTopicDue(');
        expect(source).toContain('tema.mergeTopicTracks(');
        expect(source).toContain('partialTopicIds');
        expect(source).toMatch(/fullRead\s*\?\s*TOPIC_MAX_PAGES\s*:\s*1/);
    });
});

describe('baixes de canals sense cap crida a l’API', () => {
    const db = {
        artists: [
            { name: 'Queda', youtube: { channels: [{ id: id(1) }, { id: id(2), type: 'topic' }] } },
            { name: 'Rebutjat', reviewStatus: 'rebutjat', youtube: { channels: [{ id: id(3) }] } },
        ],
    };
    const active = activeChannelIds(db);

    it('els canals rebutjats o que ja no són a la base són baixes, també si només tenen arxiu', () => {
        expect([...active].sort()).toEqual([id(1), id(2)]);
        const feed = { channels: { [id(1)]: { name: 'Queda' }, [id(3)]: { name: 'Rebutjat' } } };
        expect(removedChannelIds(feed, active)).toEqual([id(3)]);
        expect(removedChannelIds(feed, active, [id(1), id(4), 'no-es-un-canal'])).toEqual([id(3), id(4)]);
    });

    it('treu el canal de tots els fitxers generats i deixa la resta igual', () => {
        const data = {
            feed: {
                generatedAt: 'x',
                channels: { [id(1)]: { name: 'Queda' }, [id(3)]: { name: 'Fora' } },
                videos: [
                    { id: 'v1', channelId: id(1) },
                    { id: 'v3', channelId: id(3) },
                ],
            },
            channelIndex: { channels: [{ id: id(1) }, { id: id(3) }] },
            review: { count: 2, videos: [{ channelId: id(1) }, { channelId: id(3) }] },
            topicReview: { videos: [{ channelTitle: 'Fora' }, { channelTitle: 'Queda' }] },
            topicCatalog: { channels: { [id(2)]: {}, [id(3)]: {} } },
            catalogState: { channels: { [id(3)]: {} } },
            albums: { channels: { [id(3)]: [] } },
            audit: { topicCoverage: [{ id: id(3) }], unresolvedChannelIds: [id(3)], feedChannelCount: 2 },
        };
        const out = purgeChannels(data, [id(3)]);
        expect(out.feed.videos.map(v => v.id)).toEqual(['v1']);
        expect(Object.keys(out.feed.channels)).toEqual([id(1)]);
        expect(out.feed.generatedAt).toBe('x');
        expect(out.channelIndex.channels).toEqual([{ id: id(1) }]);
        expect(out.review).toEqual({ count: 1, videos: [{ channelId: id(1) }] });
        expect(out.topicReview.videos).toEqual([{ channelTitle: 'Queda' }]);
        expect(Object.keys(out.topicCatalog.channels)).toEqual([id(2)]);
        expect(out.catalogState.channels).toEqual({});
        expect(out.albums.channels).toEqual({});
        expect(out.audit.topicCoverage).toEqual([]);
        expect(out.audit.unresolvedChannelIds).toEqual([]);
        expect(out.audit.feedChannelCount).toBe(1);
        // no toca l'original
        expect(data.feed.videos).toHaveLength(2);
    });

    it('si un canal que es queda té el mateix nom, la revisió del Tema no se’n toca', () => {
        const data = {
            feed: { channels: { [id(1)]: { name: 'Artista' }, [id(3)]: { name: 'Artista' } }, videos: [] },
            topicReview: { videos: [{ channelTitle: 'Artista' }] },
        };
        expect(purgeChannels(data, [id(3)]).topicReview.videos).toHaveLength(1);
    });

    it('el script no fa servir l’API de YouTube', () => {
        const source = read('scripts/purgar_canals_feed.js') + read('scripts/lib/purga_canals.js');
        expect(source).not.toMatch(/googleapis|YOUTUBE_API_KEY|fetch\(/);
    });
});

describe('què fa el workflow «Actualitzar feed musical»', () => {
    const summer = new Date('2026-07-01T18:04:00Z');
    const winter = new Date('2026-12-01T19:20:00Z');

    it('un sol cron local a les 20 h funciona tot l’any', () => {
        expect(madridOffsetHours(summer)).toBe(2);
        expect(madridOffsetHours(winter)).toBe(1);
        expect(generalSchedule(summer)).toBe('0 20 * * *');
        expect(generalSchedule(winter)).toBe('0 20 * * *');
        for (const now of [summer, winter]) {
            expect(decideScope({ event: 'schedule', schedule: '0 20 2-30/2 * *', now }).work).toBe(false);
            expect(decideScope({ event: 'schedule', schedule: '0 20 * * *', now })).toMatchObject({
                work: true, runApi: true, targetIds: [],
            });
            expect(decideScope({ event: 'schedule', schedule: '0 18 * * *', now }).work).toBe(false);
            expect(decideScope({ event: 'schedule', schedule: '0 19 * * *', now }).work).toBe(false);
        }
    });

    it('altes, baixes i revisions no encadenen actualitzacions de YouTube', () => {
        for (const event of ['push', 'workflow_run', 'pull_request']) {
            expect(decideScope({ event, added: [id(5)], reviewed: [id(7)], removed: [id(3)] })).toMatchObject({
                work: false, runApi: false, targetIds: [], removed: [id(3)],
            });
        }
        expect(decideScope({ event: 'workflow_dispatch' })).toMatchObject({ runApi: true, targetIds: [] });
    });

    it('el workflow té un sol cron local, purga baixes i publica amb rebase', () => {
        const workflow = read('.github/workflows/actualitzar-feed-musica.yml');
        expect(workflow).toContain('cron: "0 20 * * *"');
        expect(workflow).toContain('timezone: "Europe/Madrid"');
        expect(workflow.match(/cron:/g)).toHaveLength(1);
        expect(workflow).not.toMatch(/^  (push|workflow_run):/m);
        expect(workflow).toContain('decideScope(');
        expect(workflow).toContain('node scripts/purgar_canals_feed.js');
        expect(workflow).toContain('bash scripts/publicar_dades.sh');
        expect(workflow).toMatch(/- name: Genera feed\n\s+if: steps\.scope\.outputs\.run_api == 'true'/);
    });

    it('cap workflow del feed fa un push sense tornar-ho a provar', () => {
        for (const file of ['actualitzar-feed-musica.yml', 'actualitzar-feed-nous-grups.yml', 'actualitzar-visualitzacions-historial.yml', 'revisar_shorts.yml']) {
            const workflow = read('.github/workflows/' + file);
            expect(workflow).toContain('scripts/publicar_dades.sh');
            expect(workflow).not.toContain('git push origin HEAD:main');
        }
        const script = read('scripts/publicar_dades.sh');
        expect(script).toContain('git pull --rebase');
        expect(script).toContain('git rebase --abort');
    });
});
