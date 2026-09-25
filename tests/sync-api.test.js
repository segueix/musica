import { describe, expect, it } from 'vitest';
import { onRequestGet, onRequestPost } from '../functions/api/sync.js';

class MockKV {
    constructor() {
        this.values = new Map();
        this.putOptions = new Map();
        this.deleted = [];
    }

    async get(key) {
        return this.values.get(key) ?? null;
    }

    async put(key, value, options = {}) {
        this.values.set(key, value);
        this.putOptions.set(key, options);
    }

    async delete(key) {
        this.values.delete(key);
        this.deleted.push(key);
    }
}

function postRequest(payload) {
    return new Request('https://segueix.test/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

describe('device pairing sync API', () => {
    it('stores the pairing code for 10 minutes and persists the UUID for 30 days', async () => {
        const kv = new MockKV();
        const payload = {
            isInitialPairing: true,
            uuid: 'device-123',
            data: { example: 'value' },
            updatedAt: '2026-09-15T12:00:00.000Z',
        };

        const response = await onRequestPost({
            request: postRequest(payload),
            env: { SEGUEIX_SYNC: kv },
        });
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.code).toMatch(/^\d{4}$/);
        expect(result.expiresInSeconds).toBe(600);
        expect(kv.putOptions.get(result.code)).toEqual({ expirationTtl: 600 });
        expect(kv.putOptions.get('device-123')).toEqual({ expirationTtl: 2592000 });
        expect(JSON.parse(kv.values.get('device-123'))).toEqual(payload);
    });

    it('returns a machine-readable reason when a pairing code is not visible yet', async () => {
        const kv = new MockKV();
        const response = await onRequestGet({
            request: new Request('https://segueix.test/api/sync?code=1234'),
            env: { SEGUEIX_SYNC: kv },
        });
        const result = await response.json();

        expect(response.status).toBe(404);
        expect(result.reason).toBe('PAIRING_CODE_NOT_FOUND');
    });

    it('consumes a valid pairing code after a successful read', async () => {
        const kv = new MockKV();
        kv.values.set('4321', JSON.stringify({
            uuid: 'device-xyz',
            data: { foo: 'bar' },
        }));

        const response = await onRequestGet({
            request: new Request('https://segueix.test/api/sync?code=4321'),
            env: { SEGUEIX_SYNC: kv },
        });
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.data.uuid).toBe('device-xyz');
        expect(kv.deleted).toContain('4321');
    });
});
