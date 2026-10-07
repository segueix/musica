// Esborrat local; la sincronització es gestiona a google-drive-sync.js.
(function (window) {
    const app = window.SegueixApp;
    const showFeedback = (...args) => app.utils.configFeedback.showConfigFeedback(...args);
    function clearAllData() {
        const btn = document.getElementById('clearAllDataBtn');
        if (!btn) return;

        if (
            !confirm(
                "S'esborraran totes les dades de l'aplicació (historial, playlists, configuració...). Vols continuar?"
            )
        ) {
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Esborrant...';

        try {
            // Una preferència de privacitat no s'ha de reactivar perquè l'usuari
            // esborri l'historial o la configuració de l'app.
            const analyticsDisabled = localStorage.getItem('catube_anonymous_analytics_enabled') === '0';
            const driveKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('catube_drive_')) driveKeys.push([key, localStorage.getItem(key)]);
            }
            localStorage.clear();
            driveKeys.forEach(([key, value]) => localStorage.setItem(key, value));
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
        document.getElementById('clearAllDataBtn')?.addEventListener('click', clearAllData);
        localStorage.removeItem('sync_device_id');
    }
    app.features.configSync = { register, clearAllData };
})(window);
