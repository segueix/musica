import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeJsonIfChanged, writeJsonIfChangedAsync } from '../scripts/lib/escriure-json-si-canvia.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpDir;
let filePath;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'segueix-wijc-'));
    filePath = path.join(tmpDir, 'arxiu.json');
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeJsonIfChanged', () => {
    it('escriu quan el fitxer no existeix', () => {
        const wrote = writeJsonIfChanged(filePath, { channelId: 'A', generatedAt: '2026-01-01T00:00:00Z', videos: [1, 2] });
        expect(wrote).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);
    });

    it('NO escriu si només canvia generatedAt (contingut idèntic)', () => {
        writeJsonIfChanged(filePath, { channelId: 'A', generatedAt: '2026-01-01T00:00:00Z', videos: [1, 2] });
        const before = fs.readFileSync(filePath, 'utf8');

        const wrote = writeJsonIfChanged(filePath, { channelId: 'A', generatedAt: '2026-07-11T23:59:59Z', videos: [1, 2] });

        expect(wrote).toBe(false);
        // El fitxer al disc no s'ha tocat: conserva el generatedAt original.
        expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
        expect(before).toContain('2026-01-01T00:00:00Z');
    });

    it('escriu si el contingut significatiu canvia (encara que generatedAt sigui igual)', () => {
        writeJsonIfChanged(filePath, { channelId: 'A', generatedAt: '2026-01-01T00:00:00Z', videos: [1, 2] });

        const wrote = writeJsonIfChanged(filePath, { channelId: 'A', generatedAt: '2026-01-01T00:00:00Z', videos: [1, 2, 3] });

        expect(wrote).toBe(true);
        expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).videos).toEqual([1, 2, 3]);
    });

    it('amb ignoreKeys buit fa comparació byte a byte (cas dels fragments d\'índex)', () => {
        writeJsonIfChanged(filePath, [{ i: '1', d: 'x' }], { indent: 0, trailingNewline: true, ignoreKeys: [] });
        const wroteSame = writeJsonIfChanged(filePath, [{ i: '1', d: 'x' }], { indent: 0, trailingNewline: true, ignoreKeys: [] });
        expect(wroteSame).toBe(false);

        const wroteDiff = writeJsonIfChanged(filePath, [{ i: '1', d: 'y' }], { indent: 0, trailingNewline: true, ignoreKeys: [] });
        expect(wroteDiff).toBe(true);
    });
});

describe('writeJsonIfChangedAsync', () => {
    it('NO escriu si només canvia generatedAt', async () => {
        await writeJsonIfChangedAsync(filePath, { generatedAt: 'a', buckets: [{ k: 1 }] }, { trailingNewline: true });
        const before = fs.readFileSync(filePath, 'utf8');

        const wrote = await writeJsonIfChangedAsync(filePath, { generatedAt: 'b', buckets: [{ k: 1 }] }, { trailingNewline: true });

        expect(wrote).toBe(false);
        expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
    });

    it('escriu si canvia un valor real', async () => {
        await writeJsonIfChangedAsync(filePath, { generatedAt: 'a', buckets: [{ k: 1 }] }, { trailingNewline: true });

        const wrote = await writeJsonIfChangedAsync(filePath, { generatedAt: 'a', buckets: [{ k: 2 }] }, { trailingNewline: true });

        expect(wrote).toBe(true);
    });
});
