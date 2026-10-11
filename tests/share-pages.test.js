import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadScript } from './setup.js';
const { generate, render } = createRequire(import.meta.url)('../scripts/generar_pagines_compartir.js');
const codec = loadScript('js/utils/share-codecs.js').SegueixApp.utils.shareCodecs;
describe('previsualitzacions estàtiques de Música', () => {
    it('genera URL pròpies i rebutja rutes arbitràries', () => {
        expect(codec.buildEntityShareUrl('canco', 'song_123-45')).toBe('https://segueix.github.io/musica/compartir/canco/song_123-45.html');
        expect(codec.buildEntityShareUrl('artista', 'UC123')).toContain('/artista/UC123.html');
        expect(codec.buildEntityShareUrl('canco', '../secret')).toBe(codec.SHARE_BASE_URL);
    });
    it('inclou metadades sense executar JS i escapa títols', () => {
        const html = render({ kind: 'canco', id: 'abc123', title: 'Cançó "nova" <script>', description: 'A & B', image: 'https://example.test/a.jpg' });
        expect(html).toContain('property="og:title" content="Cançó &quot;nova&quot; &lt;script&gt;"');
        expect(html).toContain('name="twitter:image" content="https://example.test/a.jpg"');
        expect(html).toContain('https://segueix.github.io/musica/?v=abc123');
        expect(html).not.toContain('http-equiv="refresh"');
    });
    it('cobreix feed, arxiu i artistes sense recuperar vídeos ocults o canals retirats', () => {
        const root = mkdtempSync(join(tmpdir(), 'music-share-'));
        const put = (file, value) => writeFileSync(join(root, file), JSON.stringify(value));
        try {
            mkdirSync(join(root, 'data/archive/channels'), { recursive: true });
            put('data/feed.json', { channels: { UC1: { name: 'Grup - Topic', artists: ['Grup'], avatar: 'https://example.test/grup.jpg' } }, videos: [{ id: 'recent', title: 'Nova', channelId: 'UC1' }] });
            put('data/hidden-videos.json', { videoIds: ['hidden'] });
            put('data/archive/channels/UC1.json', { videos: [{ id: 'old', title: 'Antiga', channelId: 'UC1' }, { id: 'hidden', channelId: 'UC1' }, { id: 'removed', channelId: 'UC2' }] });
            expect(generate(root)).toEqual({ artists: 1, songs: 2 });
            expect(readFileSync(join(root, 'compartir/artista/UC1.html'), 'utf8')).toContain('content="Grup"');
            expect(readFileSync(join(root, 'compartir/canco/old.html'), 'utf8')).toContain('https://i.ytimg.com/vi/old/hqdefault.jpg');
            expect(existsSync(join(root, 'compartir/canco/hidden.html'))).toBe(false);
            expect(existsSync(join(root, 'compartir/canco/removed.html'))).toBe(false);
            expect(generate(root)).toEqual({ artists: 1, songs: 2 });
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});
