(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.utils = app.utils || {};

    function showConfigFeedback(elementId, message, type) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = 'config-sync-feedback feedback-' + type;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    function hideConfigFeedback(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.classList.add('hidden');
    }

    app.utils.configFeedback = {
        showConfigFeedback,
        hideConfigFeedback
    };
})(window);
