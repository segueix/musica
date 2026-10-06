import { describe, expect, it } from 'vitest';
import { canalsRevisats } from '../scripts/lib/canals_revisats.js';

const base = {
    abans: { channels: { A: { allowedVideoIds: ['a'] }, B: { allowedVideoIds: ['b'] } } },
    despres: { channels: { A: { allowedVideoIds: ['a', 'c'] }, B: { allowedVideoIds: ['b'] } } },
    shortsAbans: {}, shortsDespres: {}, feed: { videos: [] }, actuals: new Set(['A', 'B']),
};

describe('abast de les seleccions revisades', () => {
    it('actualitza només el canal ampliat, també si la cançó nova era un fals Short', () => {
        expect(canalsRevisats({ ...base, shortsDespres: { falseShorts: ['c'] } })).toEqual(['A']);
    });
    it('inclou un altre canal si la revisió de Shorts també l’afecta', () => {
        expect(canalsRevisats({ ...base, shortsDespres: { falseShorts: ['b'] } })).toEqual(['A', 'B']);
    });
    it('no activa el mode general quan només canvia la data de revisió', () => {
        expect(canalsRevisats({ ...base, despres: { ...base.abans, updatedAt: 'avui' } })).toEqual([]);
    });
    it('detecta la retirada d’una regla i ignora canals fora de la base', () => {
        expect(canalsRevisats({ ...base, despres: { channels: {} }, actuals: new Set(['B']) })).toEqual(['B']);
    });
    it('s’atura abans de gastar quota si no pot identificar el canal', () => {
        expect(() => canalsRevisats({ ...base, shortsDespres: { falseShorts: ['desconegut'] } })).toThrow();
        expect(() => canalsRevisats({ ...base, shortsDespres: { falseShortTitleContains: ['intro'] } })).toThrow();
    });
});
