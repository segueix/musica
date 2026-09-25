(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const SYNC_DEVICE_ID_KEY = 'sync_device_id';
    const SYNC_ENDPOINT = '/api/sync';
    const PAIRING_RETRY_INTERVAL_MS = 5000;
    const PAIRING_RETRY_WINDOW_MS = 65000;
    const LOCAL_ONLY_STORAGE_KEYS = new Set(['catube_continue_watching_v1']);

    function getFeedbackUtils() {
        return app.utils && app.utils.configFeedback ? app.utils.configFeedback : null;
    }

    function showFeedback(elementId, message, type) {
        const feedback = getFeedbackUtils();
        if (feedback && typeof feedback.showConfigFeedback === 'function') {
            feedback.showConfigFeedback(elementId, message, type);
            return;
        }

        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = 'config-sync-feedback feedback-' + type;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    function hideFeedback(elementId) {
        const feedback = getFeedbackUtils();
        if (feedback && typeof feedback.hideConfigFeedback === 'function') {
            feedback.hideConfigFeedback(elementId);
            return;
        }

        const el = document.getElementById(elementId);
        if (el) el.classList.add('hidden');
    }

    function collectAllLocalStorageData() {
        const configData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (LOCAL_ONLY_STORAGE_KEYS.has(key)) continue;
            configData[key] = localStorage.getItem(key);
        }
        return configData;
    }

    function applyLocalStorageData(configData) {
        if (!configData || typeof configData !== 'object') {
            throw new Error('Dades locals no vàlides');
        }

        for (const key in configData) {
            if (LOCAL_ONLY_STORAGE_KEYS.has(key)) continue;
            localStorage.setItem(key, configData[key]);
        }
    }

    function createSyncDeviceId() {
        let value;
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            value = window.crypto.randomUUID();
        } else {
            value = 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        }
        return value;
    }

    function getSyncDeviceId() {
        return localStorage.getItem(SYNC_DEVICE_ID_KEY);
    }

    function clearSyncDeviceId() {
        localStorage.removeItem(SYNC_DEVICE_ID_KEY);
    }

    function renderLinkedSyncState() {
        const pairingSection = document.getElementById('syncPairingSection');
        const linkedSection = document.getElementById('linkedSyncActions');
        const isLinked = Boolean(getSyncDeviceId());

        if (pairingSection) {
            pairingSection.classList.toggle('hidden', isLinked);
        }

        if (linkedSection) {
            linkedSection.classList.toggle('hidden', !isLinked);
        }

        if (!isLinked && linkedSection) {
            linkedSection.classList.add('hidden');
            hideFeedback('linkedSyncFeedback');
        }
    }

    async function requestSync(url, options) {
        let response;
        try {
            response = await fetch(url, options);
        } catch (_) {
            throw new Error('No s\'ha pogut connectar amb el núvol. Revisa la connexió i torna-ho a provar.');
        }

        let result;
        try {
            result = await response.json();
        } catch (_) {
            throw new Error('Resposta del servidor no vàlida.');
        }

        if (!response.ok) {
            const error = new Error(result && result.error ? result.error : 'Error desconegut de sincronització.');
            error.status = response.status;
            error.reason = result && result.reason ? result.reason : '';
            throw error;
        }

        return result;
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function requestPairingCodeWithRetry(code, onRetry) {
        const startedAt = Date.now();

        while (true) {
            try {
                return await requestSync(`${SYNC_ENDPOINT}?code=${encodeURIComponent(code)}`, {
                    method: 'GET',
                });
            } catch (err) {
                const isPropagationMiss = err
                    && err.status === 404
                    && err.reason === 'PAIRING_CODE_NOT_FOUND';
                const retryWindowOpen = Date.now() - startedAt < PAIRING_RETRY_WINDOW_MS;

                if (!isPropagationMiss || !retryWindowOpen) {
                    throw err;
                }

                if (typeof onRetry === 'function') onRetry();
                await wait(PAIRING_RETRY_INTERVAL_MS);
            }
        }
    }

    function exportConfigManual() {
        const configData = collectAllLocalStorageData();
        const json = JSON.stringify(configData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'segueix-configuracio.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showFeedback('configManualFeedback', '✔ Fitxer descarregat', 'success');
    }

    function importConfigManual() {
        hideFeedback('configManualFeedback');
        document.getElementById('configManualFileInput').click();
    }

    function handleManualFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const configData = JSON.parse(e.target.result);
                applyLocalStorageData(configData);

                const btn = document.getElementById('importConfigManualBtn');
                btn.textContent = '\u2714';
                setTimeout(() => location.reload(), 600);
            } catch (_) {
                showFeedback('configManualFeedback', 'Fitxer no vàlid. Ha de ser un JSON correcte.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    async function generatePairingCode() {
        hideFeedback('pairingCodeFeedback');
        const btn = document.getElementById('generatePairCodeBtn');
        if (!btn) return;

        btn.disabled = true;
        btn.textContent = 'Generant...';

        try {
            const uuid = getSyncDeviceId() || createSyncDeviceId();
            const data = collectAllLocalStorageData();
            const result = await requestSync(SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    isInitialPairing: true,
                    uuid,
                    data,
                    updatedAt: new Date().toISOString(),
                }),
            });
            localStorage.setItem(SYNC_DEVICE_ID_KEY, uuid);

            const generatedCode = String(result.code || '');
            const codeInput = document.getElementById('pairingCodeInput');
            if (codeInput && generatedCode) {
                codeInput.value = generatedCode;
            }
            const expiresInSeconds = Number(result.expiresInSeconds) || 600;
            const expiresInMinutes = Math.max(1, Math.round(expiresInSeconds / 60));
            showFeedback('pairingCodeFeedback', `Codi ${result.code} generat. Tens ${expiresInMinutes} minuts per usar-lo a l'altre dispositiu.`, 'success');
            btn.textContent = 'Generar un nou codi';
        } catch (err) {
            showFeedback('pairingCodeFeedback', err.message || 'No s\'ha pogut generar el codi.', 'error');
        }
        btn.disabled = false;
    }

    async function redeemPairingCode() {
        hideFeedback('pairingRedeemFeedback');
        const input = document.getElementById('pairingCodeInput');
        const btn = document.getElementById('redeemPairCodeBtn');
        if (!input || !btn) return;

        const code = (input.value || '').replace(/\D/g, '').slice(0, 4);
        input.value = code;

        if (code.length !== 4) {
            showFeedback('pairingRedeemFeedback', 'Introdueix un codi vàlid de 4 dígits.', 'error');
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Descarregant...';

        try {
            const result = await requestPairingCodeWithRetry(code, () => {
                btn.textContent = 'Validant codi...';
            });

            const payload = result && result.data ? result.data : null;
            if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
                throw new Error('Dades de vinculació no vàlides o incompletes.');
            }

            applyLocalStorageData(payload.data);
            const pairedUuid = typeof payload.uuid === 'string' && payload.uuid.trim()
                ? payload.uuid.trim()
                : createSyncDeviceId();

            localStorage.setItem(SYNC_DEVICE_ID_KEY, pairedUuid);
            renderLinkedSyncState();
            showFeedback('linkedSyncFeedback', 'Dispositiu vinculat i dades importades correctament.', 'success');
        } catch (err) {
            const message = err && err.reason === 'PAIRING_CODE_NOT_FOUND'
                ? 'Codi no trobat o caducat. Si han passat menys de 10 minuts, comprova que l\'has escrit bé; si no, genera\'n un de nou.'
                : (err.message || 'No s\'ha pogut validar el codi.');
            showFeedback('pairingRedeemFeedback', message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    async function uploadLinkedData() {
        hideFeedback('linkedSyncFeedback');
        const btn = document.getElementById('uploadCloudSyncBtn');
        if (!btn) return;

        const uuid = getSyncDeviceId();
        if (!uuid) {
            showFeedback('linkedSyncFeedback', 'No hi ha cap vinculació activa.', 'error');
            renderLinkedSyncState();
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Pujant...';

        try {
            await requestSync(SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    uuid,
                    data: collectAllLocalStorageData(),
                    updatedAt: new Date().toISOString(),
                }),
            });

            showFeedback('linkedSyncFeedback', 'Dades pujades correctament al núvol.', 'success');
        } catch (err) {
            showFeedback('linkedSyncFeedback', err.message || 'No s\'han pogut pujar les dades.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    async function downloadLinkedData() {
        hideFeedback('linkedSyncFeedback');
        const btn = document.getElementById('downloadCloudSyncBtn');
        if (!btn) return;

        const uuid = getSyncDeviceId();
        if (!uuid) {
            showFeedback('linkedSyncFeedback', 'No hi ha cap vinculació activa.', 'error');
            renderLinkedSyncState();
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Descarregant...';

        try {
            const result = await requestSync(`${SYNC_ENDPOINT}?uuid=${encodeURIComponent(uuid)}`, {
                method: 'GET',
            });

            const payload = result && result.data ? result.data : null;
            if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
                throw new Error('No hi ha dades vàlides per aquest dispositiu.');
            }

            applyLocalStorageData(payload.data);
            localStorage.setItem(SYNC_DEVICE_ID_KEY, uuid);
            showFeedback('linkedSyncFeedback', 'Dades sincronitzades correctament. Recarregant...', 'success');
            setTimeout(() => location.reload(), 700);
        } catch (err) {
            const msg = err.message || '';
            const notFoundMsg = 'No es pot baixar: no hi ha dades al núvol per aquest dispositiu. Desvincul·la i torna a generar un codi de vinculació des de l\'altre dispositiu.';
            showFeedback('linkedSyncFeedback', msg && msg !== 'Error desconegut de sincronització.' ? msg : notFoundMsg, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    function unlinkLinkedSync() {
        hideFeedback('linkedSyncFeedback');

        if (!confirm('Vols desvincular aquest dispositiu del núvol?')) {
            return;
        }

        clearSyncDeviceId();
        renderLinkedSyncState();
        showFeedback('pairingCodeFeedback', 'Dispositiu desvinculat. Pots generar un codi nou quan vulguis.', 'success');
    }

    function clearAllData() {
        const btn = document.getElementById('clearAllDataBtn');
        if (!btn) return;

        if (!confirm("S'esborraran totes les dades de l'aplicació (historial, playlists, configuració...). Vols continuar?")) {
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Esborrant...';

        try {
            // Una preferència de privacitat no s'ha de reactivar perquè l'usuari
            // esborri l'historial o la configuració de l'app.
            const analyticsDisabled = localStorage.getItem('catube_anonymous_analytics_enabled') === '0';
            localStorage.clear();
            localStorage.removeItem('catube_defaults_v1');
            if (analyticsDisabled) {
                localStorage.setItem('catube_anonymous_analytics_enabled', '0');
            }

            showFeedback('clearDataFeedback', '✓ Dades esborrades. Recarregant...', 'success');
            setTimeout(() => location.reload(), 600);
        } catch (err) {
            console.error('Error esborrant dades:', err);
            showFeedback('clearDataFeedback', 'Error esborrant les dades.', 'error');
            btn.disabled = false;
            btn.textContent = 'Esborrar historial';
        }
    }

    function register() {
        const exportManualBtn = document.getElementById('exportConfigManualBtn');
        const importManualBtn = document.getElementById('importConfigManualBtn');
        const fileInput = document.getElementById('configManualFileInput');
        const clearBtn = document.getElementById('clearAllDataBtn');
        const generatePairCodeBtn = document.getElementById('generatePairCodeBtn');
        const redeemPairCodeBtn = document.getElementById('redeemPairCodeBtn');
        const uploadCloudSyncBtn = document.getElementById('uploadCloudSyncBtn');
        const downloadCloudSyncBtn = document.getElementById('downloadCloudSyncBtn');
        const unlinkCloudSyncBtn = document.getElementById('unlinkCloudSyncBtn');

        if (exportManualBtn) exportManualBtn.addEventListener('click', exportConfigManual);
        if (importManualBtn) importManualBtn.addEventListener('click', importConfigManual);
        if (fileInput) fileInput.addEventListener('change', handleManualFileImport);
        if (clearBtn) clearBtn.addEventListener('click', clearAllData);
        if (generatePairCodeBtn) generatePairCodeBtn.addEventListener('click', generatePairingCode);
        if (redeemPairCodeBtn) redeemPairCodeBtn.addEventListener('click', redeemPairingCode);
        if (uploadCloudSyncBtn) uploadCloudSyncBtn.addEventListener('click', uploadLinkedData);
        if (downloadCloudSyncBtn) downloadCloudSyncBtn.addEventListener('click', downloadLinkedData);
        if (unlinkCloudSyncBtn) unlinkCloudSyncBtn.addEventListener('click', unlinkLinkedSync);

        renderLinkedSyncState();
    }

    app.features.configSync = {
        register,
        exportManual: exportConfigManual,
        importManual: importConfigManual,
        clearAllData,
    };
})(window);
