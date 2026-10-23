// Google Analytics retirat: desactiva també les autoritzacions antigues.
(function () {
    'use strict';
    window['ga-disable-G-4QED7E19C0'] = true;
    try {
        localStorage.removeItem('segueix_google_analytics_consent_v1');
    } catch (_) { /* L’analítica continua desactivada sense emmagatzematge. */ }
})();
