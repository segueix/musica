import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyVideo, hasExplicitCatTag, hasCatalanQuestionOverride } = require('../scripts/depurar_videos_catala');

describe('depurador de vídeos en català', () => {
    it('classifica com a castellà un títol amb interrogant invertit sense indicis catalans forts', () => {
        const result = classifyVideo({
            id: 'es-1',
            title: '¿Como identificar el enfado?',
            description: 'Contingut sense indicis catalans forts.',
            defaultAudioLanguage: 'ca',
            tags: [],
        });
        expect(result.keep).toBe(false);
        expect(result.language).toBe('es');
        expect(result.reason).toBe('titol-interrogant-invertit');
    });

    it('considera català un títol amb ¿ si conté un accent obert', () => {
        const title = '¿Què podem fer avui?';
        expect(hasCatalanQuestionOverride(title)).toBe(true);
        expect(classifyVideo({ id: 'ca-open-accent', title, tags: [] })).toEqual({
            keep: true,
            language: 'ca',
            reason: 'titol-cat-malgrat-interrogant-invertit',
        });
    });

    it('considera català un títol amb ¿ si conté un apòstrof', () => {
        const title = "¿L'equip arriba a temps?";
        expect(hasCatalanQuestionOverride(title)).toBe(true);
        expect(classifyVideo({ id: 'ca-apostrophe', title, tags: [] })).toEqual({
            keep: true,
            language: 'ca',
            reason: 'titol-cat-malgrat-interrogant-invertit',
        });
    });

    it('l’etiqueta exacta cat anul·la la regla de l’interrogant invertit', () => {
        const video = {
            id: 'cat-override',
            title: '¿Como identificar el enfado?',
            defaultAudioLanguage: 'es',
            tags: ['educació', 'CAT'],
        };
        expect(hasExplicitCatTag(video)).toBe(true);
        expect(classifyVideo(video)).toEqual({ keep: true, language: 'ca', reason: 'tag-cat' });
    });

    it('no considera el signe ? normal un indicador de castellà', () => {
        const result = classifyVideo({
            id: 'ca-question',
            title: 'Què podem fer avui?',
            description: 'Parlem amb els creadors i les comunitats del país.',
            defaultAudioLanguage: 'ca',
            tags: [],
        });
        expect(result.keep).toBe(true);
    });

    it('descarta castellà clar per metadades i text', () => {
        const result = classifyVideo({
            id: 'es-2',
            title: 'Una historia para todos',
            description: 'Hoy hablamos con los autores y por eso queremos saber más.',
            defaultAudioLanguage: 'es',
            defaultLanguage: 'es',
            tags: [],
        });
        expect(result.keep).toBe(false);
    });

    it('conserva català clar encara que YouTube marqui l’àudio com es', () => {
        const result = classifyVideo({
            id: 'ca-mislabeled',
            title: 'Parlem amb els creadors del país',
            description: 'Aquest vídeo explica què fem i per què també ens agrada compartir-ho.',
            defaultAudioLanguage: 'es',
            tags: [],
        });
        expect(result.keep).toBe(true);
        expect(result.language).toBe('ca');
    });
});
