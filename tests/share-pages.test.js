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
            expect(generate(root)).toMatchObject({ artists: 1, songs: 2 });
            expect(readFileSync(join(root, 'compartir/artista/UC1.html'), 'utf8')).toContain('content="Grup"');
            expect(readFileSync(join(root, 'compartir/canco/old.html'), 'utf8')).toContain('https://i.ytimg.com/vi/old/hqdefault.jpg');
            expect(existsSync(join(root, 'compartir/canco/hidden.html'))).toBe(false);
            expect(existsSync(join(root, 'compartir/canco/removed.html'))).toBe(false);
            expect(generate(root)).toMatchObject({ artists: 1, songs: 2 });
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
    it('cada ràdio té una pàgina amb «Ràdio <nom>» per a WhatsApp (estils, municipis, artistes)', () => {
        expect(codec.radioShareTitle('Pop')).toBe('Ràdio Pop');
        expect(codec.radioShareTitle('A prop de Vic · Joies amagades')).toBe('Ràdio Vic');
        expect(codec.radioShareTitle('Ràdio de The Tyets')).toBe('Ràdio de The Tyets');
        expect(codec.radioShareTitle('La teva ràdio')).toBe('La teva ràdio');
        expect(codec.radioShareSlug('Ràdio L’Hospitalet de Llobregat')).toBe('radio-l-hospitalet-de-llobregat');
        expect(codec.radioShareSlug('Ràdio Sant Martí de Tous · Cel·la')).toBe('radio-sant-marti-de-tous-cella');
        expect(codec.buildRadioPageUrl('radio-vic', 'https://segueix.github.io/musica/?importData=ABC')).toBe(
            'https://segueix.github.io/musica/compartir/radio/radio-vic.html?importData=ABC'
        );
        expect(codec.buildRadioPageUrl('', 'https://segueix.github.io/musica/?importData=ABC')).toContain('/compartir/radio/index.html?importData=ABC');
        const root = mkdtempSync(join(tmpdir(), 'music-radio-'));
        try {
            mkdirSync(join(root, 'data'), { recursive: true });
            mkdirSync(join(root, 'js/utils'), { recursive: true });
            writeFileSync(join(root, 'js/utils/share-codecs.js'), readFileSync('js/utils/share-codecs.js'));
            writeFileSync(join(root, 'data/feed.json'), JSON.stringify({ channels: { UC1: { name: 'Grup', artists: ['Grup'] } }, videos: [] }));
            writeFileSync(join(root, 'data/hidden-videos.json'), JSON.stringify({ videoIds: [] }));
            writeFileSync(join(root, 'data/municipis-radio.json'), JSON.stringify({ noms: ['Vic', 'Gandia'] }));
            generate(root);
            const vic = readFileSync(join(root, 'compartir/radio/radio-vic.html'), 'utf8');
            expect(vic).toContain('property="og:title" content="Ràdio Vic"');
            expect(vic).toContain('target.search=location.search');
            expect(readFileSync(join(root, 'compartir/radio/radio-de-grup.html'), 'utf8')).toContain('content="Ràdio de Grup"');
            const list = JSON.parse(readFileSync(join(root, 'compartir/radio/index.json'), 'utf8'));
            expect(list).toEqual(expect.arrayContaining(['radio-vic', 'radio-gandia', 'radio-de-grup', 'la-teva-radio']));
            expect(existsSync(join(root, 'compartir/radio/index.html'))).toBe(true);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
    it('l’enllaç d’una ràdio porta la pàgina de previsualització i, sense pàgina, el nom al missatge', () => {
        const app = readFileSync('js/app.js', 'utf8');
        expect(app).toContain("return { linkUrl: share.url, linkTitle: share.title, text: share.hasPage ? '' : share.title };");
        expect(app).toMatch(/url: linkUrl \}/);
    });
});
