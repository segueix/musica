import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../js/features/segueix-tv.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('qualitat i seqüenciació de Segueix TV', () => {
    it('normalitza engagement i velocitat dins de cada canal', () => {
        expect(source).toContain('function engagementRate(video)');
        expect(source).toContain("comments * 2.2");
        expect(source).toContain('function viewVelocity(video)');
        expect(source).toContain('engagementBaselines');
        expect(source).toContain('velocityBaselines');
        expect(source).toContain('relativeEngagement');
        expect(source).toContain('relativeVelocity');
    });

    it('dona una prima suau als vídeos identificats explícitament en català', () => {
        expect(source).toContain('function languageBonus(video)');
        expect(source).toContain("audio === 'ca'");
        expect(source).toContain("metadata === 'ca'");
        expect(source).toContain('points += languageBonus(video)');
    });

    it('puntua la qualitat de la transició entre vídeos', () => {
        expect(source).toContain('function topicSimilarity(a, b)');
        expect(source).toContain('function transitionScore(previous, candidate, recentCategories = [])');
        expect(source).toContain('topicSimilarity(previous, candidate) * 4.2');
        expect(source).toContain('previousDuration >= 2400');
        expect(source).toContain('candidateDuration >= 300 && candidateDuration <= 1200');
        expect(source).toContain('const flow = transitionScore(previousVideo, item?.video, recentCategories)');
        expect(source).toContain('+ flow');
    });

    it('manté diversitat sense prohibir de manera rígida categories consecutives', () => {
        expect(source).toContain("recentCategories.includes(candidateCategory)");
        expect(source).not.toContain("!allowRecentCategory && choice.category && recentCategories.includes(choice.category)");
        expect(source).toContain('pickedChannels.has(choice.id)');
    });

    it('força una nova versió del cache estàtic', () => {
        expect(swSource).toContain("const CACHE_VERSION = 'tvq20260924a1'");
    });
});
