// Còpies manuals de Música: només dades personals validades, sense cap servidor.
(function (window) {
    'use strict';
    const app = window.SegueixApp;
    const dataApi = app.utils.musicData;
    const MAX_BYTES = 8 * 1024 * 1024;
    const showFeedback = (...args) => app.utils.configFeedback.showConfigFeedback(...args);
    let refreshView = null;
    let registered = false;
    let importing = false;

    function collect() {
        app.features.musicSignals?.persistForSync?.();
        return dataApi.collect();
    }

    function validateBackup(raw) {
        const d = raw?.data;
        const object = value => value && typeof value === 'object' && !Array.isArray(value);
        if (!object(d) || !['history', 'likes', 'follows', 'playlists', 'categories', 'styles'].every(key => Array.isArray(d[key])) ||
            !['prefs', 'stats', 'settings'].every(key => object(d[key])) || typeof d.mode !== 'string') {
            throw new Error('El fitxer no és una còpia completa de Segueix Música.');
        }
        return dataApi.validate(raw);
    }

    // Què hi ha de nou després de sumar la còpia: «12 cançons més a l’historial, 3 m’agrada i 1 artista seguit».
    function importSummary(previous, applied) {
        const added = key => {
            const before = new Set((previous[key] || []).map(item => String(item?.id ?? item)));
            return (applied[key] || []).filter(item => !before.has(String(item?.id ?? item))).length;
        };
        const parts = [
            [added('history'), n => (n === 1 ? '1 cançó més a l’historial' : `${n} cançons més a l’historial`)],
            [added('likes'), n => `${n} m’agrada`],
            [added('follows'), n => (n === 1 ? '1 artista seguit' : `${n} artistes seguits`)],
            [added('playlists'), n => (n === 1 ? '1 llista' : `${n} llistes`)],
            [added('categories'), n => (n === 1 ? '1 categoria' : `${n} categories`)],
        ].filter(([n]) => n > 0).map(([n, text]) => text(n));
        if (!parts.length) return '';
        return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} i ${parts[parts.length - 1]}`;
    }

    function exportManual() {
        try {
            const blob = new Blob([JSON.stringify(collect(), null, 2)], { type: 'application/json' });
            if (blob.size > MAX_BYTES) throw new Error('La còpia supera el límit de 8 MB.');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `segueix-musica-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            try {
                link.click();
            } finally {
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            showFeedback('configManualFeedback', '✓ Còpia JSON preparada per descarregar.', 'success');
        } catch (error) {
            showFeedback('configManualFeedback', error.message || 'No s’ha pogut preparar la còpia.', 'error');
        }
    }

    async function handleFileImport(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';
        if (!file || importing) return;
        importing = true;
        try {
            if (file.size > MAX_BYTES) throw new Error('El fitxer supera el límit de 8 MB.');
            let raw;
            try {
                raw = JSON.parse(await file.text());
            } catch (_) {
                throw new Error('No s’ha pogut llegir el fitxer. Ha de contenir un JSON vàlid.');
            }
            const backup = validateBackup(raw);
            if (!confirm('Les dades de la còpia s’afegiran a les d’aquest aparell: historial, m’agrada, artistes seguits, llistes, categories i preferències. No s’esborrarà res del que ja hi ha. Vols importar-la?')) return;
            // La còpia se suma al que ja hi ha (no ho substitueix): una exportació posterior ho porta tot.
            const previous = collect().data;
            const signals = app.features.musicSignals;
            const merged = dataApi.merge(previous, backup.data, {
                ...(signals?.mergePrefs ? { mergePrefs: signals.mergePrefs } : {}),
                ...(signals?.mergeStats ? { mergeStats: signals.mergeStats } : {}),
            });
            const applied = dataApi.apply(merged);
            signals?.replaceSynchronizedData?.(applied);
            const summary = importSummary(previous, applied);
            const done = summary ? `✓ Còpia sumada a aquest aparell: ${summary}.` : '✓ Còpia sumada a aquest aparell.';
            // La importació ja està desada encara que una vista no es pugui repintar.
            try {
                await refreshView?.(applied, previous);
            } catch (_) {
                showFeedback('configManualFeedback', `${done} Torna a obrir Música per actualitzar la vista.`, 'success');
                return;
            }
            showFeedback('configManualFeedback', done, 'success');
        } catch (error) {
            const message = error.name === 'QuotaExceededError'
                ? 'No hi ha prou espai al navegador. S’han conservat les dades anteriors.'
                : error.message || 'No s’ha pogut importar la còpia.';
            showFeedback('configManualFeedback', message, 'error');
        } finally {
            importing = false;
        }
    }

    function clearAllData() {
        const btn = document.getElementById('clearAllDataBtn');
        if (!btn || !confirm('S’esborraran les dades locals de Música. Descarrega una còpia JSON si les vols conservar. Vols continuar?')) return;
        btn.disabled = true;
        try {
            // No toca dades alienes a l’app ni reactiva el consentiment de YouTube.
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if ((/^(catube_|iutube_|segueix_)/.test(key) && !key.startsWith('segueix_cookie_consent_')) ||
                    key === 'user_liked_videos' || key === 'sync_device_id') keys.push(key);
            }
            keys.forEach(key => localStorage.removeItem(key));
            showFeedback('clearDataFeedback', '✓ Dades esborrades. Recarregant...', 'success');
            setTimeout(() => location.reload(), 600);
        } catch (_) {
            showFeedback('clearDataFeedback', 'No s’han pogut esborrar les dades.', 'error');
            btn.disabled = false;
        }
    }

    function register() {
        if (registered) return;
        registered = true;
        document.getElementById('exportConfigManualBtn')?.addEventListener('click', exportManual);
        document.getElementById('importConfigManualBtn')?.addEventListener('click', () =>
            document.getElementById('configManualFileInput')?.click());
        document.getElementById('configManualFileInput')?.addEventListener('change', handleFileImport);
        document.getElementById('clearAllDataBtn')?.addEventListener('click', clearAllData);
        // Retira només identificadors i metadades dels serveis eliminats.
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (/^catube_(drive_|anonymous_analytics_|music_anonymous_analytics_)/.test(key) || key === 'sync_device_id') {
                    localStorage.removeItem(key);
                }
            }
        } catch (_) { /* El navegador pot restringir l’emmagatzematge. */ }
    }

    app.features.configBackup = {
        register,
        registerRuntime(runtime) { refreshView = runtime.refreshView; },
        exportManual,
        handleFileImport,
        importSummary,
        validateBackup,
        clearAllData,
    };
})(window);
