import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// La quota diària de l'API de YouTube esgotada no fa fallar el workflow «Cercar canals YouTube»: el resolutor de canals
// verificats s'atura i continua a la propera execució. Qualsevol altre error de l'API sí que el fa fallar.

const require = createRequire(import.meta.url);
const { apiJson, isQuotaError } = require('../scripts/resoldre_canals_verificats.js');

function respon(status, body) {
    globalThis.fetch = vi.fn(async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }));
}

async function errorDe(status, body) {
    respon(status, body);
    try {
        await apiJson(new URL('https://www.googleapis.com/youtube/v3/channels'), 'clau');
    } catch (error) {
        return error;
    }
    return null;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe('resoldre_canals_verificats: quota de l’API', () => {
    it('la quota esgotada (403 quotaExceeded) és una aturada, no un error', async () => {
        const error = await errorDe(403, {
            error: {
                code: 403,
                message: 'The request cannot be completed because you have exceeded your quota.',
                errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota' }],
            },
        });
        expect(error.status).toBe(403);
        expect(isQuotaError(error)).toBe(true);
    });

    it('un altre error de l’API continua sent un error', async () => {
        const prohibit = await errorDe(403, { error: { code: 403, errors: [{ reason: 'forbidden' }] } });
        const clau = await errorDe(400, { error: { code: 400, errors: [{ reason: 'keyInvalid' }] } });
        expect(isQuotaError(prohibit)).toBe(false);
        expect(isQuotaError(clau)).toBe(false);
    });

    it('el workflow espera al cron o a una ordre manual i només escriu a main', () => {
        const workflow = readFileSync('.github/workflows/cercar-canals-youtube.yml', 'utf8');
        expect(workflow).not.toMatch(/^  push:/m);
        // Estalvi d'octubre de 2026 (docs/ESTALVI_ACTIONS_OCTUBRE_2026.md): de moment només és manual.
        expect(workflow).toMatch(/^\s+(cron:|workflow_dispatch:)/m);
        expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    });
});
