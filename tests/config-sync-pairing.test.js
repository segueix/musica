import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../js/features/config-sync.js', import.meta.url), 'utf8');

describe('device pairing client retry contract', () => {
    it('keeps HTTP status and server reason on sync errors', () => {
        expect(source).toContain('error.status = response.status');
        expect(source).toContain("error.reason = result && result.reason ? result.reason : ''");
    });

    it('retries a pairing-code miss long enough for KV propagation', () => {
        expect(source).toContain('PAIRING_RETRY_INTERVAL_MS = 5000');
        expect(source).toContain('PAIRING_RETRY_WINDOW_MS = 65000');
        expect(source).toContain("err.reason === 'PAIRING_CODE_NOT_FOUND'");
        expect(source).toContain('requestPairingCodeWithRetry');
    });

    it('uses the expiry returned by the server instead of a hard-coded five-minute message', () => {
        expect(source).toContain('Number(result.expiresInSeconds) || 600');
        expect(source).toContain('expiresInMinutes');
        expect(source).not.toContain('Tens 5 minuts per usar-lo');
    });
});
