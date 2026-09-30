import { describe, it, expect } from 'vitest';
import { loadScript } from './setup.js';

const ctx = loadScript('js/utils/share-codecs.js');
const shareCodecs = ctx.SegueixApp.utils.shareCodecs;

describe('buildAppShareUrl', () => {
    it("genera l'enllaç d'un vídeo apuntant a segueix.cat", () => {
        expect(shareCodecs.buildAppShareUrl('v=Jwj-SJMm93M')).toBe('https://segueix.github.io/musica/?v=Jwj-SJMm93M');
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
            'https://segueix.github.io/musica/?channel=UC123#segueix'
        );
        expect(shareCodecs.buildAppShareUrl('channel=UC123', '#segueix')).toBe(
            'https://segueix.github.io/musica/?channel=UC123#segueix'
        );
    });

    it('retorna la portada quan no hi ha query', () => {
        expect(shareCodecs.buildAppShareUrl()).toBe('https://segueix.github.io/musica/');
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
