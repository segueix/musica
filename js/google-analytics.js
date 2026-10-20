// Google Analytics és opcional i independent del consentiment de YouTube.
(function () {
    'use strict';
    const id = 'G-4QED7E19C0';
    const key = 'segueix_google_analytics_consent_v1';
    let started = false;
    let accepted = false;
    try { accepted = localStorage.getItem(key) === 'accepted'; } catch (_) { /* Sense persistència. */ }

    function applyConsent(value) {
        accepted = value;
        window['ga-disable-' + id] = !accepted;
        document.querySelectorAll('[data-google-analytics-consent]').forEach(input => {
            input.checked = accepted;
        });
        if (!accepted || started) return;
        started = true;
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', id, {
            // No incloure dades de llistes compartides, cerques ni fragments en la visita inicial.
            page_location: window.location.origin + window.location.pathname,
            page_referrer: document.referrer ? new URL(document.referrer).origin : '',
            page_title: 'Segueix Música',
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
        });
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
        document.head.appendChild(script);
    }

    function saveConsent(value) {
        try { localStorage.setItem(key, value ? 'accepted' : 'rejected'); } catch (_) { /* Només aquesta visita. */ }
        applyConsent(value);
    }

    document.querySelectorAll('[data-google-analytics-consent]').forEach(input => {
        input.addEventListener('change', () => saveConsent(input.checked));
    });
    document.getElementById('cookieRejectBtn')?.addEventListener('click', () => saveConsent(false));
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) applyConsent(event.newValue === 'accepted');
    });
    applyConsent(accepted);
})();
