import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { onRequestGet, onRequestPost } from '../functions/api/analytics.js';

const clientSource = readFileSync(new URL('../js/features/analytics.js', import.meta.url), 'utf8');
const endpointSource = readFileSync(new URL('../functions/api/analytics.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const smartFeedSource = readFileSync(new URL('../js/features/smart-feed.js', import.meta.url), 'utf8');
const configSyncSource = readFileSync(new URL('../js/features/config-sync.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../js/features/analytics-admin.js', import.meta.url), 'utf8');
const pdfSource = readFileSync(new URL('../js/features/analytics-pdf.js', import.meta.url), 'utf8');

function request(body, headers = {}) {
    return new Request('https://segueix.cat/api/analytics', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'sec-fetch-site': 'same-origin',
            origin: 'https://segueix.cat',
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

describe('analytics anònims de producte', () => {
    it('només accepta un vocabulari tancat d’esdeveniments', async () => {
        const put = vi.fn(async () => {});
        const response = await onRequestPost({
            request: request({ event: 'inventat', context: {} }),
            env: { SEGUEIX_SYNC: { put } },
        });

        expect(response.status).toBe(400);
        expect(put).not.toHaveBeenCalled();
        expect(endpointSource).toContain("'smart_feed_rendered'");
        expect(endpointSource).toContain("'tv_regenerate'");
    });

    it('descarta camps sensibles encara que el client els intenti enviar', async () => {
        const writes = [];
        const kv = {
            async put(key, value, options) {
                writes.push({ key, value, options });
            },
        };

        const response = await onRequestPost({
            request: request({
                event: 'video_open',
                context: {
                    surface: 'home',
                    device: 'mobile',
                    category: 'cultura',
                    videoId: 'secret-video',
                    channelId: 'secret-channel',
                    query: 'text privat',
                    userAgent: 'agent',
                },
            }),
            env: { SEGUEIX_SYNC: kv },
        });

        expect(response.status).toBe(204);
        expect(writes).toHaveLength(1);
        expect(writes[0].key).toMatch(/^analytics:v1:/);
        expect(writes[0].options.expirationTtl).toBe(60 * 60 * 24 * 90);

        const stored = JSON.parse(writes[0].value);
        expect(stored.context).toEqual({
            surface: 'home',
            device: 'mobile',
            category: 'cultura',
        });
        expect(stored.context.videoId).toBeUndefined();
        expect(stored.context.channelId).toBeUndefined();
        expect(stored.context.query).toBeUndefined();
        expect(stored.context.userAgent).toBeUndefined();
    });

    it('no desa IP ni user-agent al servidor', () => {
        expect(endpointSource).not.toContain('cf-connecting-ip');
        expect(endpointSource).not.toContain('CF-Connecting-IP');
        expect(endpointSource).not.toContain("headers.get('user-agent')");
        expect(endpointSource).not.toContain('request.cf');
    });

    it('protegeix el resum administratiu amb token', async () => {
        const unauthorized = await onRequestGet({
            request: new Request('https://segueix.cat/api/analytics?days=7'),
            env: {
                ANALYTICS_ADMIN_TOKEN: 'secret',
                SEGUEIX_SYNC: { list: vi.fn() },
            },
        });
        expect(unauthorized.status).toBe(401);

        const today = new Date();
        const day = [
            today.getUTCFullYear(),
            String(today.getUTCMonth() + 1).padStart(2, '0'),
            String(today.getUTCDate()).padStart(2, '0'),
        ].join('-');
        const keys = [
            { name: `analytics:v1:${day}:video_open:17:d-mobile:s-home:c-cultura:t-other:x-off:a` },
            { name: `analytics:v1:${day}:video_open:18:d-desktop:s-watch:c-other:t-other:x-off:b` },
            { name: `analytics:v1:${day}:tv_start:18:d-mobile:s-tv:c-other:t-segueix:x-off:c` },
            { name: `analytics:v1:${day}:follow_toggle:18:d-mobile:s-channel:c-other:t-other:x-on:d` },
        ];
        const list = vi.fn(async ({ prefix }) => ({
            keys: prefix.includes(day) ? keys : [],
            list_complete: true,
        }));
        const authorized = await onRequestGet({
            request: new Request('https://segueix.cat/api/analytics?days=1', {
                headers: { authorization: 'Bearer secret' },
            }),
            env: {
                ANALYTICS_ADMIN_TOKEN: 'secret',
                SEGUEIX_SYNC: { list },
            },
        });

        expect(authorized.status).toBe(200);
        const body = await authorized.json();
        expect(body.totals.video_open).toBe(2);
        expect(body.totals.tv_start).toBe(1);
        expect(body.totals.follow_toggle).toBe(1);
        expect(body.dimensions.device.mobile).toBe(3);
        expect(body.dimensions.device.desktop).toBe(1);
        expect(body.dimensions.tvMode.segueix).toBe(1);
        expect(body.dimensions.state['follow_toggle:on']).toBe(1);
    });

    it('el client és cookieless i permet desactivar la recollida', () => {
        expect(clientSource).toContain("const ENABLED_KEY = 'catube_anonymous_analytics_enabled'");
        expect(clientSource).toContain("const CLIENT_ID_KEY = 'catube_anonymous_analytics_client_v1'");
        expect(clientSource).toContain('CLIENT_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000');
        expect(clientSource).toContain("localStorage.getItem(ENABLED_KEY) !== '0'");
        expect(clientSource).toContain('toggleAnonymousAnalyticsBtn');
        expect(clientSource).toContain('navigator.sendBeacon');
        expect(clientSource).toContain('getRandomValues');
        expect(clientSource).not.toContain('navigator.userAgent');
        expect(clientSource).not.toContain('crypto.randomUUID');
    });

    it('hasha l’identificador rotatiu i mai desa el valor original', async () => {
        const writes = [];
        const kv = {
            async put(key, value, options) {
                writes.push({ key, value, options });
            },
        };
        const clientId = '0123456789abcdef0123456789abcdef';

        const response = await onRequestPost({
            request: request({
                event: 'video_open',
                clientId,
                context: { surface: 'home', device: 'mobile', category: 'cultura' },
            }),
            env: { SEGUEIX_SYNC: kv },
        });

        expect(response.status).toBe(204);
        expect(writes).toHaveLength(1);
        expect(writes[0].key).toContain(':u-');
        expect(writes[0].key).not.toContain(clientId);
        expect(writes[0].value).not.toContain(clientId);
        expect(endpointSource).toContain("crypto.subtle.digest('SHA-256'");
    });

    it('preserva l’opt-out quan s’esborren les dades de l’app', () => {
        expect(configSyncSource).toContain("localStorage.getItem('catube_anonymous_analytics_enabled') === '0'");
        expect(configSyncSource).toContain("localStorage.setItem('catube_anonymous_analytics_enabled', '0')");
    });

    it('mesura les funcions clau sense enviar identificadors de contingut', () => {
        expect(clientSource).toContain("'video_open'");
        expect(clientSource).toContain("'search_used'");
        expect(clientSource).toContain("'follow_toggle'");
        expect(clientSource).toContain("'like_toggle'");
        expect(clientSource).toContain("'tv_start'");
        expect(clientSource).toContain("'tv_next'");
        expect(clientSource).toContain("'tv_regenerate'");
        expect(clientSource).toContain("'continue_watching_open'");
        expect(smartFeedSource).toContain("analytics?.track?.('smart_feed_rendered'");
    });

    it('ofereix panell administratiu per URL, amb token només de sessió', () => {
        expect(adminSource).toContain("get('analytics') === '1'");
        expect(adminSource).toContain("sessionStorage.setItem(TOKEN_KEY, token)");
        expect(adminSource).toContain("from: range.from");
        expect(adminSource).toContain("to: range.to");
        expect(adminSource).toContain("fetch(\`/api/analytics?\${params.toString()}\`");
        expect(adminSource).toContain("authorization: \`Bearer \${token}\`");
        expect(adminSource).toContain('const ALLOWED_DAYS = [7, 30, 90]');
        expect(adminSource).toContain('analyticsAdminFrom');
        expect(adminSource).toContain('analyticsAdminTo');
        expect(adminSource).toContain('analyticsAdminApplyRange');
        expect(adminSource).toContain('analyticsAdminPdf');
        expect(clientSource).toContain("if (isAdminView() || !enabled()) return false");
    });

    it('permet consultar una franja exacta de dates de fins a 90 dies', async () => {
        const today = new Date();
        const to = [
            today.getUTCFullYear(),
            String(today.getUTCMonth() + 1).padStart(2, '0'),
            String(today.getUTCDate()).padStart(2, '0'),
        ].join('-');
        const yesterday = new Date(today.getTime() - 86400000);
        const from = [
            yesterday.getUTCFullYear(),
            String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
            String(yesterday.getUTCDate()).padStart(2, '0'),
        ].join('-');

        const keysByDay = new Map([
            [from, [
                { name: `analytics:v1:${from}:video_open:10:d-mobile:s-home:c-cultura:t-other:x-off:u-user-a:a` },
                { name: `analytics:v1:${from}:video_open:12:d-mobile:s-home:c-cultura:t-other:x-off:u-user-b:b` },
            ]],
            [to, [
                { name: `analytics:v1:${to}:tv_start:11:d-desktop:s-tv:c-other:t-segueix:x-off:u-user-a:c` },
                { name: `analytics:v1:${to}:follow_toggle:13:d-mobile:s-channel:c-other:t-other:x-on:u-user-a:d` },
            ]],
        ]);
        const list = vi.fn(async ({ prefix }) => {
            const day = prefix.split(':')[2];
            return { keys: keysByDay.get(day) || [], list_complete: true };
        });

        const response = await onRequestGet({
            request: new Request(`https://segueix.cat/api/analytics?from=${from}&to=${to}`, {
                headers: { authorization: 'Bearer secret' },
            }),
            env: {
                ANALYTICS_ADMIN_TOKEN: 'secret',
                SEGUEIX_SYNC: { list },
            },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.from).toBe(from);
        expect(body.to).toBe(to);
        expect(body.days).toBe(2);
        expect(body.daily).toHaveLength(2);
        expect(body.totals.video_open).toBe(2);
        expect(body.totals.tv_start).toBe(1);
        expect(body.audience.uniqueBrowsers).toBe(2);
        expect(body.audience.recurrentBrowsers).toBe(1);
        expect(body.audience.singleDayBrowsers).toBe(1);
        expect(body.audience.videoUsers).toBe(2);
        expect(body.audience.tvUsers).toBe(1);
        expect(body.audience.followUsers).toBe(1);
        expect(body.daily[0].unique_browsers).toBe(2);
        expect(body.daily[1].unique_browsers).toBe(1);
    });

    it('rebutja franges de més de 90 dies', async () => {
        const response = await onRequestGet({
            request: new Request('https://segueix.cat/api/analytics?from=2026-01-01&to=2026-04-15', {
                headers: { authorization: 'Bearer secret' },
            }),
            env: {
                ANALYTICS_ADMIN_TOKEN: 'secret',
                SEGUEIX_SYNC: { list: vi.fn() },
            },
        });
        expect(response.status).toBe(400);
    });

    it('genera un informe PDF local sense enviar dades a tercers', () => {
        expect(pdfSource).toContain("type: 'application/pdf'");
        expect(pdfSource).toContain("segueix-analytics-${summary.from}-${summary.to}.pdf");
        expect(pdfSource).toContain("app.features.analyticsPdf");
        expect(pdfSource).toContain("'Usuaris únics'");
        expect(pdfSource).toContain("'Recurrents'");
        expect(pdfSource).toContain('unique_browsers');
        expect(pdfSource).not.toContain('fetch(');
        expect(pdfSource).not.toContain('XMLHttpRequest');
    });

    it('carrega el mòdul, el precacheja i informa l’usuari', () => {
        expect(indexSource).toContain('js/features/analytics.js?v=20260925-unique-users-v1');
        expect(indexSource).toContain('Configuració &gt; Analítica anònima');
        expect(indexSource).toContain('identificador aleatori que rota cada 90 dies');
        expect(indexSource).toContain('js/features/analytics-pdf.js?v=20260925-unique-users-v1');
        expect(indexSource).toContain('js/features/analytics-admin.js?v=20260925-unique-users-v1');
        expect(swSource).toContain("'./js/features/analytics.js'");
        expect(swSource).toContain("'./js/features/analytics-pdf.js'");
        expect(swSource).toContain("'./js/features/analytics-admin.js'");
        expect(swSource).toMatch(/const CACHE_VERSION = '[a-z0-9_-]+'/i);
    });
});
