import { describe, it, expect } from 'vitest';
import fs from 'fs';
import vm from 'vm';

function loadParser() {
    let source = fs.readFileSync('scripts/resoldre_canals_youtube.js', 'utf8');
    source = source
        .replace(/if \(!API_KEY\)[\s\S]*?\n}\n\n/, '')
        .replace(/main\(\)\.catch\([\s\S]*$/, '');
    source += '\nthis.__test = { parseCandidate };';
    const sandbox = { URL, console, require, process: { env: {}, argv: [] } };
    vm.runInNewContext(source, sandbox);
    return sandbox.__test;
}

const api = loadParser();

describe('YouTube candidate parser', () => {
    it('resol un @handle', () => {
        expect(api.parseCandidate({ url: 'https://www.youtube.com/@mariajaume_', handle: '@mariajaume_' }))
            .toEqual({ kind: 'handle', value: '@mariajaume_' });
    });

    it('resol una URL legacy /user/', () => {
        expect(api.parseCandidate({ url: 'https://www.youtube.com/user/JoanDausa', handle: null }))
            .toEqual({ kind: 'username', value: 'JoanDausa' });
    });

    it('no inventa criteri per una URL desconeguda', () => {
        expect(api.parseCandidate({ url: 'https://www.youtube.com/c/algun-canal', handle: null }))
            .toBe(null);
    });
});
