(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const TOKEN_KEY = 'segueix_analytics_admin_token';
    const DEFAULT_DAYS = 30;
    const ALLOWED_DAYS = [7, 30, 90];
    const EVENT_LABELS = {
        app_open: 'Entrades',
        video_open: 'Vídeos oberts',
        search_used: 'Cerques',
        follow_toggle: 'Canvis de seguiment',
        like_toggle: 'Canvis de ❤️',
        category_open: 'Categories obertes',
        smart_feed_rendered: 'Feed intel·ligent',
        tv_start: 'TV iniciades',
        tv_next: 'Següent a TV',
        tv_regenerate: 'TV regenerades',
        continue_watching_open: 'Continua mirant',
    };
    const DIMENSION_LABELS = {
        mobile: 'Mòbil',
        desktop: 'Escriptori',
        home: 'Inici',
        watch: 'Vídeo',
        tv: 'TV',
        search: 'Cerca',
        follow: 'Segueix',
        library: 'Biblioteca',
        history: 'Historial',
        channel: 'Canal',
        novetats: 'Novetats',
        descobreix: 'Descobreix',
        pop: 'Pop',
        rock: 'Rock',
        indie: 'Indie',
        urbana: 'Urbana',
        rap_hiphop: 'Rap / Hip-hop',
        folk_arrel: 'Folk i arrel',
        canco_autor: "Cançó d'autor",
        electronica: 'Electrònica',
        ska_reggae: 'Ska / Reggae',
        rumba_mestissatge: 'Rumba / Mestissatge',
        punk_metal: 'Punk / Metal',
        jazz_blues: 'Jazz / Blues',
        classica: 'Clàssica',
        infantil: 'Infantil',
        altres_estils: 'Altres estils',
        seguint: 'Seguint',
        tot: 'Tot / Recomanat',
        custom: 'Categoria pròpia',
        segueix: 'Música TV',
        category: 'TV de categoria',
        program: 'TV de programa',
        playlist: 'Llista',
        other: 'Altres',
    };

    function requested() {
        try {
            return new URLSearchParams(window.location.search || '').get('analytics') === '1';
        } catch {
            return false;
        }
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function number(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function percent(numerator, denominator) {
        const a = number(numerator);
        const b = number(denominator);
        if (!b) return '—';
        return `${Math.round((a / b) * 1000) / 10}%`;
    }

    function compact(value) {
        return new Intl.NumberFormat('ca-ES', {
            notation: number(value) >= 10000 ? 'compact' : 'standard',
            maximumFractionDigits: 1,
        }).format(number(value));
    }

    function label(value) {
        return DIMENSION_LABELS[value] || EVENT_LABELS[value] || value || '—';
    }

    function formatDay(day) {
        try {
            return new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' })
                .format(new Date(`${day}T12:00:00Z`));
        } catch {
            return day;
        }
    }

    function isoDay(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function todayIso() {
        return isoDay(new Date());
    }

    function daysAgoIso(offset) {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() - Math.max(0, Number(offset) || 0));
        return isoDay(date);
    }

    function presetRange(days) {
        const safeDays = Math.max(1, Math.min(90, Number(days) || DEFAULT_DAYS));
        return {
            from: daysAgoIso(safeDays - 1),
            to: todayIso(),
            preset: safeDays,
        };
    }

    function normalizeRange(value) {
        if (typeof value === 'number') return presetRange(value);
        const from = String(value?.from || '').trim();
        const to = String(value?.to || '').trim();
        return {
            from: from || daysAgoIso(DEFAULT_DAYS - 1),
            to: to || todayIso(),
            preset: ALLOWED_DAYS.includes(Number(value?.preset)) ? Number(value.preset) : null,
        };
    }

    function inclusiveDays(from, to) {
        const start = new Date(`${from}T12:00:00`);
        const end = new Date(`${to}T12:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
        return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    }

    function rangeError(from, to) {
        if (!from || !to) return 'Selecciona les dues dates.';
        if (from > to) return 'La data inicial no pot ser posterior a la final.';
        if (to > todayIso()) return 'La data final no pot ser futura.';
        const days = inclusiveDays(from, to);
        if (!days || days > 90) return 'La franja pot tenir com a màxim 90 dies.';
        if (from < daysAgoIso(89)) return 'Només es conserven els darrers 90 dies d’analytics.';
        return '';
    }

    function formatRange(from, to) {
        try {
            const formatter = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${formatter.format(new Date(`${from}T12:00:00`))} - ${formatter.format(new Date(`${to}T12:00:00`))}`;
        } catch {
            return `${from} - ${to}`;
        }
    }

    function ensureStyles() {
        if (document.getElementById('analyticsAdminStyles')) return;
        const style = document.createElement('style');
        style.id = 'analyticsAdminStyles';
        style.textContent = `
            body.analytics-admin-open{overflow:hidden!important}
            .analytics-admin-shell{position:fixed;inset:0;z-index:12000;overflow:auto;background:var(--color-background,#181818);color:var(--color-text,#f4f4f4);font-family:inherit}
            .analytics-admin-inner{width:min(1180px,calc(100% - 28px));margin:0 auto;padding:24px 0 48px}
            .analytics-admin-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
            .analytics-admin-title{font-size:clamp(1.45rem,4vw,2.2rem);line-height:1.1;margin:0}
            .analytics-admin-subtitle{margin:5px 0 0;color:var(--color-text-secondary,#aaa);font-size:.9rem;font-weight:500}
            .analytics-admin-close,.analytics-admin-btn{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;border-radius:10px;min-height:40px;padding:8px 13px;cursor:pointer;font:inherit;font-weight:700}
            .analytics-admin-close{width:42px;padding:0;font-size:1.5rem}
            .analytics-admin-btn:hover,.analytics-admin-close:hover{background:rgba(255,255,255,.11)}
            .analytics-admin-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
            .analytics-admin-periods{display:flex;gap:8px;flex-wrap:wrap}
            .analytics-admin-period.is-active{background:var(--color-primary,#c00);border-color:var(--color-primary,#c00)}
            .analytics-admin-range{display:flex;flex-wrap:wrap;align-items:end;gap:9px;margin:0 0 18px;padding:12px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025);border-radius:12px}
            .analytics-admin-date-field{display:grid;gap:4px;min-width:155px}
            .analytics-admin-date-field span{font-size:.72rem;color:var(--color-text-secondary,#aaa);font-weight:700}
            .analytics-admin-date-input{min-height:40px;border:1px solid rgba(255,255,255,.15);border-radius:9px;background:rgba(0,0,0,.22);color:inherit;padding:7px 9px;font:inherit;color-scheme:dark}
            .analytics-admin-range-error{flex-basis:100%;min-height:1em;color:#ff9b9b;font-size:.78rem}
            .analytics-admin-pdf-btn{background:rgba(255,255,255,.1)}
            .analytics-admin-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
            .analytics-admin-card,.analytics-admin-panel{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:14px}
            .analytics-admin-card{padding:16px}
            .analytics-admin-kicker{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-secondary,#aaa)}
            .analytics-admin-value{font-size:clamp(1.45rem,3vw,2.2rem);font-weight:900;line-height:1.15;margin-top:5px}
            .analytics-admin-note{font-size:.78rem;color:var(--color-text-secondary,#aaa);margin-top:4px}
            .analytics-admin-panel{padding:16px;margin-top:14px}
            .analytics-admin-panel h3{font-size:1rem;margin:0 0 14px}
            .analytics-admin-chart{height:210px;display:flex;align-items:flex-end;gap:4px;border-bottom:1px solid rgba(255,255,255,.1);padding-top:10px}
            .analytics-admin-day{flex:1;min-width:2px;display:flex;align-items:flex-end;gap:1px;height:100%;position:relative}
            .analytics-admin-bar{flex:1;min-width:2px;border-radius:3px 3px 0 0;background:currentColor;opacity:.8}
            .analytics-admin-day:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);white-space:nowrap;background:#111;border:1px solid rgba(255,255,255,.14);border-radius:7px;padding:5px 7px;font-size:.7rem;z-index:2}
            .analytics-admin-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:.78rem;color:var(--color-text-secondary,#aaa)}
            .analytics-admin-legend span::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:currentColor;margin-right:5px}
            .analytics-admin-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
            .analytics-admin-list{display:grid;gap:9px}
            .analytics-admin-row{display:grid;grid-template-columns:minmax(110px,180px) 1fr auto;gap:10px;align-items:center;font-size:.84rem}
            .analytics-admin-track{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
            .analytics-admin-fill{height:100%;background:currentColor;border-radius:inherit}
            .analytics-admin-count{font-variant-numeric:tabular-nums;font-weight:700}
            .analytics-admin-login{width:min(460px,calc(100% - 28px));margin:12vh auto 0;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:16px;padding:22px}
            .analytics-admin-login h2{margin:0 0 6px}
            .analytics-admin-login p{color:var(--color-text-secondary,#aaa);font-size:.88rem;margin:0 0 15px}
            .analytics-admin-input{width:100%;min-height:44px;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(0,0,0,.22);color:inherit;padding:9px 11px;font:inherit}
            .analytics-admin-login-actions{display:flex;gap:9px;margin-top:12px}
            .analytics-admin-error{margin-top:12px;color:#ff8d8d;font-size:.84rem}
            .analytics-admin-loading{padding:50px 16px;text-align:center;color:var(--color-text-secondary,#aaa)}
            .analytics-admin-table{width:100%;border-collapse:collapse;font-size:.84rem}
            .analytics-admin-table td,.analytics-admin-table th{padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left}
            .analytics-admin-table th:last-child,.analytics-admin-table td:last-child{text-align:right}
            @media(max-width:850px){.analytics-admin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-admin-two{grid-template-columns:1fr}}
            @media(max-width:520px){.analytics-admin-inner{width:min(100% - 18px,1180px);padding-top:14px}.analytics-admin-grid{grid-template-columns:1fr 1fr;gap:8px}.analytics-admin-card{padding:12px}.analytics-admin-toolbar{align-items:flex-start}.analytics-admin-row{grid-template-columns:95px 1fr auto;gap:7px}.analytics-admin-chart{height:170px}}
        `;
        document.head.appendChild(style);
    }

    function shell() {
        let root = document.getElementById('analyticsAdminShell');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'analyticsAdminShell';
        root.className = 'analytics-admin-shell';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Analytics de Segueix');
        document.body.appendChild(root);
        document.body.classList.add('analytics-admin-open');
        return root;
    }

    function close() {
        sessionStorage.removeItem(TOKEN_KEY);
        const root = document.getElementById('analyticsAdminShell');
        root?.remove();
        document.body.classList.remove('analytics-admin-open');
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('analytics');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch {}
    }

    function renderLogin(message = '') {
        const root = shell();
        root.innerHTML = `
            <div class="analytics-admin-login">
                <h2>Analytics de Segueix</h2>
                <p>Introdueix el token administratiu. Només es conserva durant aquesta sessió del navegador.</p>
                <input class="analytics-admin-input" id="analyticsAdminTokenInput" type="password" autocomplete="current-password" placeholder="ANALYTICS_ADMIN_TOKEN">
                <div class="analytics-admin-login-actions">
                    <button class="analytics-admin-btn" id="analyticsAdminLoginBtn" type="button">Entrar</button>
                    <button class="analytics-admin-btn" id="analyticsAdminCancelBtn" type="button">Tancar</button>
                </div>
                <div class="analytics-admin-error" id="analyticsAdminLoginError">${escapeHtml(message)}</div>
            </div>
        `;

        const input = root.querySelector('#analyticsAdminTokenInput');
        const submit = async () => {
            const token = String(input?.value || '').trim();
            if (!token) return;
            sessionStorage.setItem(TOKEN_KEY, token);
            await load(DEFAULT_DAYS, token);
        };
        root.querySelector('#analyticsAdminLoginBtn')?.addEventListener('click', submit);
        root.querySelector('#analyticsAdminCancelBtn')?.addEventListener('click', close);
        input?.addEventListener('keydown', event => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') close();
        });
        input?.focus();
    }

    async function fetchSummary(range, token) {
        const params = new URLSearchParams({
            from: range.from,
            to: range.to,
        });
        const response = await fetch(`/api/analytics?${params.toString()}`, {
            headers: { authorization: `Bearer ${token}` },
            credentials: 'same-origin',
            cache: 'no-store',
        });

        if (response.status === 401) throw new Error('TOKEN_INVALID');
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 503 && /not configured/i.test(String(body?.error || ''))) {
                throw new Error('TOKEN_NOT_CONFIGURED');
            }
            throw new Error(body?.error || `HTTP ${response.status}`);
        }
        return body;
    }

    function metricCard(title, value, note = '') {
        return `
            <article class="analytics-admin-card">
                <div class="analytics-admin-kicker">${escapeHtml(title)}</div>
                <div class="analytics-admin-value">${escapeHtml(value)}</div>
                ${note ? `<div class="analytics-admin-note">${escapeHtml(note)}</div>` : ''}
            </article>
        `;
    }

    function dimensionRows(data = {}) {
        const entries = Object.entries(data)
            .map(([key, value]) => [key, number(value)])
            .filter(([, value]) => value > 0)
            .sort((a, b) => b[1] - a[1]);
        const max = Math.max(1, ...entries.map(([, value]) => value));
        if (!entries.length) return '<div class="analytics-admin-note">Encara no hi ha prou dades noves per aquest desglossament.</div>';

        return `<div class="analytics-admin-list">${entries.map(([key, value]) => `
            <div class="analytics-admin-row">
                <span>${escapeHtml(label(key))}</span>
                <div class="analytics-admin-track"><div class="analytics-admin-fill" style="width:${Math.max(2, value / max * 100)}%"></div></div>
                <span class="analytics-admin-count">${escapeHtml(compact(value))}</span>
            </div>
        `).join('')}</div>`;
    }

    function dailyChart(daily = []) {
        const values = daily.map(day => ({
            day: day.day,
            unique: number(day.unique_browsers),
            app: number(day.app_open),
            video: number(day.video_open),
            tv: number(day.tv_start),
        }));
        const max = Math.max(1, ...values.flatMap(item => [item.unique, item.app, item.video, item.tv]));
        return `
            <div class="analytics-admin-chart">
                ${values.map(item => `
                    <div class="analytics-admin-day" data-tip="${escapeHtml(formatDay(item.day))}: ${item.unique} únics · ${item.app} entrades · ${item.video} vídeos · ${item.tv} TV">
                        <span class="analytics-admin-bar" style="height:${item.unique / max * 100}%;opacity:.25"></span>
                        <span class="analytics-admin-bar" style="height:${item.app / max * 100}%;opacity:.45"></span>
                        <span class="analytics-admin-bar" style="height:${item.video / max * 100}%;opacity:.72"></span>
                        <span class="analytics-admin-bar" style="height:${item.tv / max * 100}%;opacity:1"></span>
                    </div>
                `).join('')}
            </div>
            <div class="analytics-admin-legend">
                <span style="opacity:.35">Usuaris únics</span>
                <span style="opacity:.55">Entrades</span>
                <span style="opacity:.8">Vídeos</span>
                <span>TV</span>
            </div>
        `;
    }

    function eventTable(totals = {}) {
        return `
            <table class="analytics-admin-table">
                <thead><tr><th>Esdeveniment</th><th>Total</th></tr></thead>
                <tbody>
                    ${Object.entries(EVENT_LABELS).map(([key, title]) => `
                        <tr><td>${escapeHtml(title)}</td><td>${escapeHtml(compact(totals[key] || 0))}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderDashboard(summary, selectedRange) {
        const root = shell();
        const totals = summary?.totals || {};
        const dims = summary?.dimensions || {};
        const audience = summary?.audience || {};
        const uniqueBrowsers = number(audience.uniqueBrowsers);
        const recurrentBrowsers = number(audience.recurrentBrowsers);
        const videoUsers = number(audience.videoUsers);
        const tvUsers = number(audience.tvUsers);
        const smartFeedUsers = number(audience.smartFeedUsers);
        const followUsers = number(audience.followUsers);
        const followOn = number(dims.state?.['follow_toggle:on']);
        const followOff = number(dims.state?.['follow_toggle:off']);
        const videoOpen = number(totals.video_open);
        const tvStarts = number(totals.tv_start);
        const tvNext = number(totals.tv_next);

        root.innerHTML = `
            <div class="analytics-admin-inner">
                <header class="analytics-admin-head">
                    <div>
                        <h1 class="analytics-admin-title">Analytics de Segueix</h1>
                        <p class="analytics-admin-subtitle">Comptadors anònims de producte · ${escapeHtml(formatRange(summary.from, summary.to))} · ${summary.days} dies</p>
                    </div>
                    <button class="analytics-admin-close" id="analyticsAdminClose" type="button" aria-label="Tancar">×</button>
                </header>

                <div class="analytics-admin-toolbar">
                    <div class="analytics-admin-periods">
                        ${ALLOWED_DAYS.map(value => `<button class="analytics-admin-btn analytics-admin-period ${value === selectedRange?.preset ? 'is-active' : ''}" type="button" data-days="${value}">${value} dies</button>`).join('')}
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="analytics-admin-btn analytics-admin-pdf-btn" id="analyticsAdminPdf" type="button">Descarrega informe PDF</button>
                        <button class="analytics-admin-btn" id="analyticsAdminRefresh" type="button">Actualitza</button>
                    </div>
                </div>

                <div class="analytics-admin-range">
                    <label class="analytics-admin-date-field">
                        <span>Des de</span>
                        <input class="analytics-admin-date-input" id="analyticsAdminFrom" type="date" min="${daysAgoIso(89)}" max="${todayIso()}" value="${escapeHtml(summary.from)}">
                    </label>
                    <label class="analytics-admin-date-field">
                        <span>Fins a</span>
                        <input class="analytics-admin-date-input" id="analyticsAdminTo" type="date" min="${daysAgoIso(89)}" max="${todayIso()}" value="${escapeHtml(summary.to)}">
                    </label>
                    <button class="analytics-admin-btn" id="analyticsAdminApplyRange" type="button">Aplica franja</button>
                    <span class="analytics-admin-note">Màxim 90 dies</span>
                    <div class="analytics-admin-range-error" id="analyticsAdminRangeError"></div>
                </div>

                <section class="analytics-admin-grid">
                    ${metricCard('Usuaris únics', compact(uniqueBrowsers), 'Navegadors/dispositius anònims')}
                    ${metricCard('Recurrents', compact(recurrentBrowsers), uniqueBrowsers ? `${percent(recurrentBrowsers, uniqueBrowsers)} dels únics` : '—')}
                    ${metricCard('Vídeos / usuari', uniqueBrowsers ? (number(audience.videosPerBrowser)).toFixed(1).replace('.', ',') : '—', `${compact(videoUsers)} usuaris han obert vídeos`)}
                    ${metricCard('Usuaris de TV', compact(tvUsers), uniqueBrowsers ? `${percent(tvUsers, uniqueBrowsers)} dels únics` : '—')}
                    ${metricCard('Entrades', compact(totals.app_open || 0))}
                    ${metricCard('Vídeos oberts', compact(videoOpen))}
                    ${metricCard('TV iniciades', compact(tvStarts), `Següent/TV: ${percent(tvNext, tvStarts)}`)}
                    ${metricCard('Cerques', compact(totals.search_used || 0))}
                    ${metricCard('Feed intel·ligent', compact(totals.smart_feed_rendered || 0), `${compact(smartFeedUsers)} usuaris únics`)}
                    ${metricCard('Nous follows', compact(followOn), `${compact(followUsers)} usuaris · Baixes: ${compact(followOff)}`)}
                    ${metricCard('Follow / vídeo', percent(followOn, videoOpen), 'Indicador orientatiu')}
                    ${metricCard('Regeneracions TV', compact(totals.tv_regenerate || 0), `Per TV: ${percent(totals.tv_regenerate, tvStarts)}`)}
                </section>

                <section class="analytics-admin-panel">
                    <h3>Evolució diària</h3>
                    ${dailyChart(summary?.daily || [])}
                </section>

                <div class="analytics-admin-two">
                    <section class="analytics-admin-panel">
                        <h3>Dispositiu</h3>
                        ${dimensionRows(dims.device)}
                    </section>
                    <section class="analytics-admin-panel">
                        <h3>Superfície</h3>
                        ${dimensionRows(dims.surface)}
                    </section>
                </div>

                <div class="analytics-admin-two">
                    <section class="analytics-admin-panel">
                        <h3>Categories</h3>
                        ${dimensionRows(dims.category)}
                    </section>
                    <section class="analytics-admin-panel">
                        <h3>Tipus de TV</h3>
                        ${dimensionRows(dims.tvMode)}
                    </section>
                </div>

                <section class="analytics-admin-panel">
                    <h3>Tots els comptadors</h3>
                    ${eventTable(totals)}
                </section>

                <p class="analytics-admin-note" style="margin-top:14px">
                    Els usuaris únics són navegadors/dispositius anònims, no persones identificades. L'identificador aleatori rota cada 90 dies i el servidor només en conserva un hash no reversible. No es desen IP, user-agent, textos de cerca, vídeos ni canals.
                </p>
            </div>
        `;

        root.querySelector('#analyticsAdminClose')?.addEventListener('click', close);
        root.querySelector('#analyticsAdminRefresh')?.addEventListener('click', () => load(selectedRange));
        root.querySelectorAll('[data-days]').forEach(button => {
            button.addEventListener('click', () => load(number(button.dataset.days) || DEFAULT_DAYS));
        });

        root.querySelector('#analyticsAdminApplyRange')?.addEventListener('click', () => {
            const from = root.querySelector('#analyticsAdminFrom')?.value || '';
            const to = root.querySelector('#analyticsAdminTo')?.value || '';
            const message = rangeError(from, to);
            const errorBox = root.querySelector('#analyticsAdminRangeError');
            if (errorBox) errorBox.textContent = message;
            if (message) return;
            load({ from, to, preset: null });
        });

        root.querySelector('#analyticsAdminPdf')?.addEventListener('click', event => {
            const button = event.currentTarget;
            try {
                button.disabled = true;
                const fileName = app.features.analyticsPdf?.download?.(summary);
                if (!fileName) throw new Error('PDF_GENERATOR_NOT_AVAILABLE');
                button.textContent = 'PDF descarregat';
                window.setTimeout(() => {
                    button.textContent = 'Descarrega informe PDF';
                    button.disabled = false;
                }, 1200);
            } catch (error) {
                console.error('No s’ha pogut generar el PDF:', error);
                button.textContent = 'Error generant PDF';
                window.setTimeout(() => {
                    button.textContent = 'Descarrega informe PDF';
                    button.disabled = false;
                }, 1800);
            }
        });
    }

    async function load(selection = DEFAULT_DAYS, suppliedToken = '') {
        const range = normalizeRange(selection);
        const validationError = rangeError(range.from, range.to);
        if (validationError) {
            const root = shell();
            root.innerHTML = `<div class="analytics-admin-login"><h2>Franja no vàlida</h2><p>${escapeHtml(validationError)}</p><button class="analytics-admin-btn" id="analyticsAdminRangeBack" type="button">Torna als darrers 30 dies</button></div>`;
            root.querySelector('#analyticsAdminRangeBack')?.addEventListener('click', () => load(DEFAULT_DAYS));
            return;
        }

        const token = suppliedToken || sessionStorage.getItem(TOKEN_KEY) || '';
        if (!token) {
            renderLogin();
            return;
        }

        const root = shell();
        root.innerHTML = '<div class="analytics-admin-loading">Carregant analytics…</div>';

        try {
            const summary = await fetchSummary(range, token);
            renderDashboard(summary, range);
        } catch (error) {
            const code = String(error?.message || '');
            if (code === 'TOKEN_INVALID') {
                sessionStorage.removeItem(TOKEN_KEY);
                renderLogin('Token incorrecte.');
                return;
            }
            if (code === 'TOKEN_NOT_CONFIGURED') {
                sessionStorage.removeItem(TOKEN_KEY);
                renderLogin('Falta configurar ANALYTICS_ADMIN_TOKEN a Cloudflare.');
                return;
            }
            root.innerHTML = `
                <div class="analytics-admin-login">
                    <h2>No s'han pogut carregar les dades</h2>
                    <p>${escapeHtml(code || 'Error desconegut')}</p>
                    <div class="analytics-admin-login-actions">
                        <button class="analytics-admin-btn" id="analyticsAdminRetry" type="button">Torna-ho a provar</button>
                        <button class="analytics-admin-btn" id="analyticsAdminCancelBtn" type="button">Tancar</button>
                    </div>
                </div>
            `;
            root.querySelector('#analyticsAdminRetry')?.addEventListener('click', () => load(range));
            root.querySelector('#analyticsAdminCancelBtn')?.addEventListener('click', close);
        }
    }

    function init() {
        if (!requested()) return false;
        ensureStyles();
        load(DEFAULT_DAYS);
        return true;
    }

    app.features.analyticsAdmin = {
        init,
        open: () => {
            ensureStyles();
            load(DEFAULT_DAYS);
        },
        close,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
