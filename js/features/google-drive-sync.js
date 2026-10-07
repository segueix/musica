// Google Drive appDataFolder. Tokens només en memòria; cap servidor de Segueix.
(function (window) {
    'use strict';
    const app = window.SegueixApp;
    const model = app.utils.driveSyncModel;
    const dataApi = app.utils.musicData;
    const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
    const API = 'https://www.googleapis.com/drive/v3/';
    const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/';
    const LINK_KEY = 'catube_drive_account_v1';
    const DEVICE_KEY = 'catube_drive_device_v1';
    const PREFIX = 'catube_drive_state_v1_';
    const PRODUCT = 'segueix-musica-drive-v1';
    let token = '';
    let expires = 0;
    let busy = false;
    let sdkPromise;
    const byId = (id) => document.getElementById(id);
    const clientId = () => window.SEGUEIX_GOOGLE_DRIVE_CLIENT_ID || '';
    const read = (key) => {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    };

    function feedback(message, error = false) {
        const el = byId('googleDriveFeedback');
        if (!el) return;
        el.textContent = message;
        el.className = 'config-sync-feedback feedback-' + (error ? 'error' : 'success');
    }

    function render() {
        const button = byId('googleDriveSync');
        if (!button) return;
        let account;
        try {
            account = read(LINK_KEY);
        } catch (_) {
            /* Estat no disponible: es mostrarà en connectar. */
        }
        button.disabled = busy || !clientId();
        button.textContent = busy ? 'Sincronitzant…' : account ? 'Sincronitza' : 'Connecta amb Google Drive';
        const disconnect = byId('googleDriveDisconnect');
        disconnect.hidden = !account;
        disconnect.disabled = busy;
        byId('googleDriveAccount').textContent = account
            ? `Compte: ${account.label}${account.lastSync ? ' · Última sincronització: ' + new Date(account.lastSync).toLocaleString('ca-ES') : ''}`
            : '';
        if (!clientId()) {
            feedback(
                'La sincronització amb Google Drive està pendent d’activació. Les teves dades continuen desades en aquest aparell.'
            );
        }
    }

    function loadSdk() {
        if (window.google?.accounts?.oauth2) return Promise.resolve();
        if (sdkPromise) return sdkPromise;
        sdkPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timer = setTimeout(() => fail(), 15000);
            function fail() {
                clearTimeout(timer);
                script.remove();
                sdkPromise = null;
                reject(new Error('No s’ha pogut carregar Google. Revisa la connexió i torna-ho a provar.'));
            }
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = () => {
                clearTimeout(timer);
                resolve();
            };
            script.onerror = fail;
            document.head.appendChild(script);
        });
        return sdkPromise;
    }

    function authorize() {
        if (token && Date.now() < expires) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const oauth = window.google.accounts.oauth2;
            const client = oauth.initTokenClient({
                client_id: clientId(),
                scope: SCOPE,
                include_granted_scopes: false,
                callback: (response) => {
                    if (response.error || !response.access_token || !oauth.hasGrantedAllScopes(response, SCOPE)) {
                        reject(new Error('No s’ha autoritzat la sincronització. Les dades locals es conserven.'));
                        return;
                    }
                    token = response.access_token;
                    expires = Date.now() + Math.max(0, Number(response.expires_in) - 60) * 1000;
                    resolve();
                },
                error_callback: (error) =>
                    reject(
                        new Error(
                            error.type === 'popup_closed'
                                ? 'Has cancel·lat la connexió amb Google.'
                                : 'Permet la finestra de Google i torna a prémer el botó.'
                        )
                    ),
            });
            client.requestAccessToken({ prompt: localStorage.getItem(LINK_KEY) ? '' : 'select_account' });
        });
    }

    async function request(path, options = {}, upload = false) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch((upload ? UPLOAD : API) + path, {
                ...options,
                signal: controller.signal,
                cache: 'no-store',
                credentials: 'omit',
                headers: { ...options.headers, Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    token = '';
                    expires = 0;
                }
                const message =
                    response.status === 401
                        ? 'La sessió de Google ha caducat. Prem «Sincronitza» per renovar-la.'
                        : response.status === 403
                          ? 'Google no permet aquesta operació. Comprova el permís de Drive i que l’API estigui activada.'
                          : response.status === 429
                            ? 'Google està limitant les peticions. Torna-ho a provar d’aquí a una estona.'
                            : response.status === 404
                              ? 'La còpia de Drive ja no existeix. Torna a sincronitzar per crear-la.'
                              : 'Google Drive no ha pogut completar la sincronització. Torna-ho a provar.';
                const error = new Error(message);
                error.status = response.status;
                throw error;
            }
            const text = await response.text();
            if (text.length > 12 * 1024 * 1024) throw new Error('La còpia de Drive no es pot processar.');
            return text ? JSON.parse(text) : {};
        } catch (error) {
            if (error.name === 'AbortError' || error instanceof TypeError) {
                throw new Error(
                    'No s’ha pogut connectar amb Drive. Les dades locals es conserven; torna-ho a provar quan tinguis connexió.'
                );
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    async function listFiles() {
        const files = [];
        let pageToken;
        do {
            const params = new URLSearchParams({
                spaces: 'appDataFolder',
                q: `trashed = false and appProperties has { key='product' and value='${PRODUCT}' }`,
                fields: 'nextPageToken,files(id,appProperties)',
                pageSize: '100',
            });
            if (pageToken) params.set('pageToken', pageToken);
            const page = await request('files?' + params);
            files.push(...(page.files || []));
            pageToken = page.nextPageToken;
        } while (pageToken);
        return files;
    }

    async function writeFile(fileId, device, doc) {
        if (fileId) {
            return request(
                `files/${encodeURIComponent(fileId)}?uploadType=media&fields=id`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(doc),
                },
                true
            );
        }
        const boundary = 'segueix_' + window.crypto.randomUUID();
        const metadata = {
            name: `musica-${device}.json`,
            parents: ['appDataFolder'],
            mimeType: 'application/json',
            appProperties: { product: PRODUCT, device },
        };
        return request(
            'files?uploadType=multipart&fields=id',
            {
                method: 'POST',
                headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
                body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(doc)}\r\n--${boundary}--`,
            },
            true
        );
    }

    async function synchronize() {
        const about = await request('about?fields=user(permissionId,displayName,emailAddress)');
        const user = about.user;
        if (!user || !/^[A-Za-z0-9_-]+$/.test(user.permissionId || '')) {
            throw new Error('No s’ha pogut identificar el compte de Drive.');
        }
        const linked = read(LINK_KEY);
        if (linked && linked.id !== user.permissionId) {
            token = '';
            expires = 0;
            throw new Error('Has triat un altre compte. Desconnecta primer aquest aparell si vols canviar de compte.');
        }
        const account = {
            id: user.permissionId,
            label: user.emailAddress || user.displayName || 'Google Drive',
            lastSync: linked?.lastSync || null,
        };
        let device = localStorage.getItem(DEVICE_KEY);
        if (!device) {
            device = window.crypto.randomUUID();
            localStorage.setItem(DEVICE_KEY, device);
        }
        const stateKey = PREFIX + account.id;
        const saved = read(stateKey) || { doc: model.empty(), baseline: {} };
        model.validate(saved.doc);
        const initial = dataApi.collect().data;
        let doc = model.update(saved.doc, saved.baseline, initial, device);
        const files = await listFiles();
        // Cada aparell escriu el seu fitxer: dos aparells no es trepitgen una escriptura.
        for (const file of files) {
            doc = model.merge(doc, await request(`files/${encodeURIComponent(file.id)}?alt=media`));
        }
        const beforeUpload = dataApi.collect().data;
        doc = model.limitHistory(model.update(doc, initial, beforeUpload, device), device);
        // Conserva també els canvis pendents si la connexió cau després de l'escriptura remota.
        localStorage.setItem(stateKey, JSON.stringify({ doc, baseline: beforeUpload }));
        localStorage.setItem(LINK_KEY, JSON.stringify(account));
        const ownFile = files.find((file) => file.appProperties?.device === device);
        await writeFile(ownFile?.id, device, doc);
        const latest = dataApi.collect().data;
        doc = model.limitHistory(model.update(doc, beforeUpload, latest, device), device);
        const merged = model.materialize(doc);
        const changed = JSON.stringify(model.flatten(latest)) !== JSON.stringify(model.flatten(merged));
        // El diari s'escriu primer: si falta espai no s'aplica cap dada remota parcialment.
        const pending = localStorage.getItem(stateKey);
        localStorage.setItem(stateKey, JSON.stringify({ doc, baseline: merged }));
        try {
            dataApi.apply(merged);
        } catch (error) {
            localStorage.setItem(stateKey, pending);
            throw error;
        }
        app.features.musicSignals?.replaceSynchronizedData?.(merged);
        account.lastSync = new Date().toISOString();
        localStorage.setItem(LINK_KEY, JSON.stringify(account));
        feedback(
            changed ? 'Sincronització completada. Actualitzant Música…' : 'Sincronització completada. Tot al dia.'
        );
        if (changed) setTimeout(() => window.location.reload(), 800);
        return { changed };
    }

    async function connect() {
        if (busy || !clientId()) return;
        busy = true;
        render();
        try {
            if (navigator.onLine === false) throw new Error('Necessites connexió a Internet per sincronitzar.');
            if (!navigator.locks) throw new Error('Actualitza el navegador per poder sincronitzar de manera segura.');
            // Si el SDK ja és carregat, conserva el gest de l'usuari fins a requestAccessToken.
            if (!window.google?.accounts?.oauth2) await loadSdk();
            await authorize();
            await navigator.locks.request('segueix-musica-drive-sync', { ifAvailable: true }, async (lock) => {
                if (!lock) throw new Error('Música ja s’està sincronitzant en una altra pestanya.');
                await synchronize();
            });
        } catch (error) {
            feedback(
                error.name === 'QuotaExceededError'
                    ? 'No hi ha prou espai al navegador per aplicar la sincronització. Les dades locals es conserven.'
                    : error.message,
                true
            );
        } finally {
            busy = false;
            render();
        }
    }

    function disconnect() {
        if (busy) return;
        token = '';
        expires = 0;
        localStorage.removeItem(LINK_KEY);
        feedback('Aquest aparell està desconnectat. Les dades locals i la còpia de Drive es conserven.');
        render();
    }

    function register() {
        byId('googleDriveSync')?.addEventListener('click', connect);
        byId('googleDriveDisconnect')?.addEventListener('click', disconnect);
        window.addEventListener('storage', (event) => {
            if (event.key === LINK_KEY) render();
        });
        render();
    }
    app.features.googleDriveSync = { register, connect, disconnect, synchronize, listFiles, SCOPE };
})(window);
