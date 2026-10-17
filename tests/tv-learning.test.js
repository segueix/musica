import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const learning = readFileSync(new URL('../js/features/tv-learning.js', import.meta.url), 'utf8');
const segueixTV = readFileSync(new URL('../js/features/segueix-tv.js', import.meta.url), 'utf8');
const contextTV = readFileSync(new URL('../js/features/context-tv.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const swVersioner = readFileSync(new URL('../scripts/actualitzar_versio_sw.js', import.meta.url), 'utf8');

describe('aprenentatge local de les TV', () => {
    it('aprèn del percentatge vist i dels salts ràpids sense xarxa', () => {
        expect(learning).toContain("const STORAGE_KEY = 'segueix_tv_learning_v1'");
        expect(learning).toContain('if (ratio >= 0.85)');
        expect(learning).toContain('if (ratio >= 0.60)');
        expect(learning).toContain('if (ratio >= 0.35)');
        expect(learning).toContain("ratio < 0.15 || position < 45");
        expect(learning).toContain('if (ratio < 0.20)');
        expect(learning).toContain('localStorage.setItem(STORAGE_KEY');
        expect(learning).not.toContain('fetch(');
        expect(learning).not.toContain('XMLHttpRequest');
    });

    it('aprèn tema, categoria i durada i limita la influència', () => {
        expect(learning).toContain('tokensForVideo(item.video)');
        expect(learning).toContain('categoriesForVideo(item.video)');
        expect(learning).toContain('durationBucket(item.duration');
        expect(learning).toContain('function affinityForVideo(video)');
        expect(learning).toContain('Math.max(-4.2, Math.min(4.2');
    });

    it('manté aproximadament una quarta part de descoberta a Segueix TV', () => {
        expect(segueixTV).toContain('function behaviorAffinity(video)');
        expect(segueixTV).toContain('points += behaviorAffinity(video)');
        expect(segueixTV).toContain('(result.length + 1) % 4 === 0');
        expect(segueixTV).toContain('learningAdjustment = explorationSlot');
    });

    it('aplica aprenentatge moderat a les TV contextuals', () => {
        expect(contextTV).toContain('function learnedAffinity(video)');
        expect(contextTV).toContain('score += learnedAffinity(video) * 0.65');
    });

    // La informació «Com es crea una TV?» d'app.js es va treure amb Segueix TV: ja no es comprova.
    it('carrega i precacheja el nou mòdul i resol assets amb query', () => {
        expect(index).toContain('js/features/tv-learning.js?v=20260924-learning-v1');
        expect(sw).toContain("'./js/features/tv-learning.js'");
        expect(sw).toMatch(/const CACHE_VERSION = '[a-z0-9_-]+'/i);
        expect(swVersioner).toContain("rel = rel.split(/[?#]/, 1)[0]");
    });
});
