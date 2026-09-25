import { describe, it, expect } from 'vitest';
import fs from 'fs';
import vm from 'vm';

function loadParser() {
    let source = fs.readFileSync('scripts/enriquir_artistes_musicbrainz.js', 'utf8');
    source = source.replace(/main\(\)\.catch\([\s\S]*$/, '');
    source += '\nthis.__test = { parseYouTubeUrl, extractYouTubeRelations };';
    const sandbox = { URL, console, require, process, setTimeout, clearTimeout };
    vm.runInNewContext(source, sandbox);
    return sandbox.__test;
}

const api = loadParser();

describe('MusicBrainz YouTube parser', () => {
    it('extreu un channel ID oficial', () => {
        const parsed = api.parseYouTubeUrl('https://www.youtube.com/channel/UC9X30uS2tBqnVwEqpmA32xQ');
        expect(parsed.channelId).toBe('UC9X30uS2tBqnVwEqpmA32xQ');
    });

    it('conserva handles que encara no tenen channel ID', () => {
        const parsed = api.parseYouTubeUrl('https://www.youtube.com/@grupcatala');
        expect(parsed.channelId).toBe(null);
        expect(parsed.handle).toBe('@grupcatala');
    });

    it('només accepta relacions de YouTube', () => {
        const relations = api.extractYouTubeRelations({
            relations: [
                { type: 'youtube', url: { resource: 'https://youtube.com/channel/UC9X30uS2tBqnVwEqpmA32xQ' } },
                { type: 'official homepage', url: { resource: 'https://example.com' } },
            ],
        });
        expect(relations).toHaveLength(1);
    });
});
