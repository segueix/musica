import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { resolveChannelDisplayName, isHandleName, findNameOverride, stripOfficialWord } = createRequire(import.meta.url)('../scripts/lib/nom_canal.js');

describe('nom real del canal enlloc del handle', () => {
    it('substitueix el títol que és només el handle pel nom de l\'artista', () => {
        expect(resolveChannelDisplayName('elspetsoficial', '@elspetsoficial', ['Els Pets'])).toBe('Els Pets');
        expect(resolveChannelDisplayName('@kitschvideos', '@kitschvideos', ['Kitsch'])).toBe('Kitsch');
    });

    it('conserva els noms reals encara que s\'assemblin al handle', () => {
        expect(resolveChannelDisplayName('Lluís Llach', '@lluisllach', ['Lluís Llach i Grande'])).toBe('Lluís Llach');
        expect(resolveChannelDisplayName('Ceaxe', '@ceaxe', ['Ceaxe'])).toBe('Ceaxe');
    });

    it('no toca canals compartits per diversos artistes', () => {
        expect(resolveChannelDisplayName('abcdef', '@abcdef', ['A', 'B'])).toBe('abcdef');
    });

    it('detecta el handle ignorant majúscules i símbols', () => {
        expect(isHandleName('DemencialWeare', '@demencialweare')).toBe(true);
        expect(isHandleName('Els Pets', '@elspets')).toBe(false);
    });

    it('les correccions manuals manen, per ID o per handle', () => {
        const overrides = { UCabc: 'Pawn Gang', '@elspetsoficial': 'Els Pets' };
        expect(findNameOverride(overrides, 'UCabc', '@x')).toBe('Pawn Gang');
        expect(findNameOverride(overrides, 'UCzzz', '@ElsPetsOficial')).toBe('Els Pets');
        expect(findNameOverride(overrides, 'UCzzz', '@altre')).toBe('');
    });

    it('treu «Oficial»/«Official» del nom del grup', () => {
        expect(stripOfficialWord('Txarango Oficial')).toBe('Txarango');
        expect(stripOfficialWord('KOP Official')).toBe('KOP');
        expect(stripOfficialWord('Buhos (Oficial)')).toBe('Buhos');
        expect(stripOfficialWord('Oficial')).toBe('Oficial');
        expect(resolveChannelDisplayName('Ginestà Oficial', '@ginestaoficial', ['Ginestà'])).toBe('Ginestà');
    });
});
