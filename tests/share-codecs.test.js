import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';
import LZString from 'lz-string';

const ctx = loadScript('js/utils/share-codecs.js');
const shareCodecs = ctx.SegueixApp.utils.shareCodecs;

describe('domini públic de totes les comparticions', () => {
    it.each([
        'https://segueix.github.io/musica/',
        'https://musica-3qm.pages.dev/',
        'https://preview.example/',
    ])('manté el domini públic encara que el paquet es publiqui a %s', base => {
        const codec = loadScript('js/utils/share-codecs.js', { SEGUEIX_PUBLIC_URL: base, LZString }).SegueixApp.utils.shareCodecs;
        const origin = 'https://musica.segueix.cat';
        const direct = new URL(codec.buildAppShareUrl('v=song_123-45&t=90', 'segueix'));
        expect(direct.origin).toBe(origin);
        expect(direct.searchParams.get('t')).toBe('90');
        expect(direct.hash).toBe('#segueix');
        for (const kind of ['canco', 'artista']) {
            expect(new URL(codec.buildEntityShareUrl(kind, 'test123')).origin).toBe(origin);
        }
        for (const type of ['playlist', 'radio', 'category', 'history', 'nearby']) {
            const payload = codec.buildImportPayload({ type, name: 'Música de Vic', items: ['song123'],
                place: { name: 'Vic', territory: 'Catalunya', coordinates: { latitude: 41.93, longitude: 2.25 } } });
            const url = new URL(codec.buildImportUrl(payload));
            expect(url.origin).toBe(origin);
            expect(url.pathname).toBe(type === 'playlist' ? '/llista/musica-de-vic/'
                : ['radio', 'nearby'].includes(type) ? '/radio/radio-musica-de-vic/' : '/');
            expect(codec.decodeImportPayload(url.searchParams.get('importData'))).toEqual(payload);
            for (const slug of ['radio-vic', '']) {
                const radio = new URL(codec.buildRadioPageUrl(slug, url.href));
                expect(radio.origin).toBe(origin);
                expect(radio.search).toBe(url.search);
            }
        }
    });
});

describe('buildAppShareUrl', () => {
    it("genera l'enllaç d'un vídeo apuntant a musica.segueix.cat", () => {
        expect(shareCodecs.buildAppShareUrl('v=Jwj-SJMm93M')).toBe('https://musica.segueix.cat/?v=Jwj-SJMm93M');
    });

    it("no afegeix cap paràmetre extra (el cache buster trencava el segon d'inici)", () => {
        const url = shareCodecs.buildAppShareUrl('v=Jwj-SJMm93M');
        expect(url).not.toMatch(/[?&]t=/);
        expect(new URL(url).searchParams.get('t')).toBeNull();
    });

    it('accepta la query amb o sense interrogant inicial', () => {
        expect(shareCodecs.buildAppShareUrl('?channel=UC123')).toBe(shareCodecs.buildAppShareUrl('channel=UC123'));
    });

    it('afegeix el hash normalitzat', () => {
        expect(shareCodecs.buildAppShareUrl('channel=UC123', 'segueix')).toBe(
            'https://musica.segueix.cat/?channel=UC123#segueix'
        );
        expect(shareCodecs.buildAppShareUrl('channel=UC123', '#segueix')).toBe(
            'https://musica.segueix.cat/?channel=UC123#segueix'
        );
    });

    it('retorna la portada quan no hi ha query', () => {
        expect(shareCodecs.buildAppShareUrl()).toBe('https://musica.segueix.cat/');
    });
});

describe('parseShareStartSeconds', () => {
    it("accepta un segon d'inici raonable", () => {
        expect(shareCodecs.parseShareStartSeconds('90')).toBe(90);
        expect(shareCodecs.parseShareStartSeconds(125.7)).toBe(125);
    });

    it('ignora els timestamps en mil·lisegons dels enllaços antics', () => {
        // Els enllaços compartits fins al juliol de 2026 portaven ?t=Date.now()
        expect(shareCodecs.parseShareStartSeconds('1785500000000')).toBe(0);
        expect(shareCodecs.parseShareStartSeconds(String(24 * 60 * 60 + 1))).toBe(0);
    });

    it('accepta el límit exacte de 24 hores', () => {
        expect(shareCodecs.parseShareStartSeconds(24 * 60 * 60)).toBe(86400);
    });

    it('retorna 0 per a valors buits o invàlids', () => {
        expect(shareCodecs.parseShareStartSeconds(null)).toBe(0);
        expect(shareCodecs.parseShareStartSeconds('')).toBe(0);
        expect(shareCodecs.parseShareStartSeconds('abc')).toBe(0);
        expect(shareCodecs.parseShareStartSeconds('-30')).toBe(0);
    });
});
