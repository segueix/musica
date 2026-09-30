// Selector de categories: substitueix visualment la barra de xips de la pàgina principal.
// La barra (.chips-bar) continua al DOM com a font de veritat (ordre, categories
// personalitzades, Segueix TV...) i el selector hi delega els clics amb chip.click().
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;

    const CHEVRON =
        '<svg class="category-selector-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';

    let root = null;
    let button = null;
    let valueEl = null;
    let panel = null;
    let bar = null;

    function getChipLabel(chip) {
        if (chip.classList.contains('segueix-tv-chip')) return 'Música TV';
        const value = (chip.dataset.cat || chip.textContent || '').trim();
        // «Novetats» és l'identificador intern de la portada: a la interfície és «Inici»
        return value === 'Novetats' ? 'Inici' : value;
    }

    function getSelectableChips() {
        if (!bar) return [];
        return Array.from(bar.querySelectorAll('.chip')).filter(
            chip => !chip.classList.contains('chip-info') && (chip.classList.contains('chip-add') || chip.dataset.cat)
        );
    }

    function escapeText(value) {
        const div = document.createElement('div');
        div.textContent = value;
        return div.innerHTML;
    }

    function updateValue() {
        if (!valueEl || !bar) return;
        const active = bar.querySelector('.chip.is-active[data-cat], .chip.chip-loading[data-cat]');
        valueEl.textContent = active ? getChipLabel(active) : 'Inici';
        root.classList.toggle('hidden', bar.classList.contains('hidden'));
    }

    function closePanel() {
        if (!panel || panel.hidden) return;
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        root.classList.remove('is-open');
    }

    function buildOptions() {
        const activeChip = bar.querySelector('.chip.is-active[data-cat]');
        const chips = getSelectableChips();
        chips.forEach((chip, index) => chip.setAttribute('data-selector-index', String(index)));
        panel.innerHTML = chips
            .map((chip, index) => {
                if (chip.classList.contains('chip-add')) {
                    return `<button type="button" class="category-selector-option category-selector-add" role="option" data-index="${index}">+ Afegeix una categoria</button>`;
                }
                const selected = chip === activeChip;
                return `<button type="button" class="category-selector-option${selected ? ' is-selected' : ''}" role="option" aria-selected="${selected}" data-index="${index}">${escapeText(getChipLabel(chip))}</button>`;
            })
            .join('');
    }

    function openPanel() {
        buildOptions();
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        root.classList.add('is-open');
        panel.querySelector('.is-selected')?.scrollIntoView?.({ block: 'nearest' });
    }

    function togglePanel() {
        if (panel.hidden) openPanel();
        else closePanel();
    }

    function onOptionClick(event) {
        const option = event.target.closest('.category-selector-option');
        if (!option) return;
        const chip = getSelectableChips()[Number(option.dataset.index)];
        closePanel();
        if (chip) chip.click();
        window.scrollTo?.({ top: 0 });
    }

    function init() {
        bar = document.querySelector('.chips-bar.home-categories');
        if (!bar || document.getElementById('categorySelector')) return;

        root = document.createElement('div');
        root.className = 'category-selector';
        root.id = 'categorySelector';
        root.innerHTML = `
            <button type="button" class="category-selector-btn" aria-haspopup="listbox" aria-expanded="false">
                <span class="category-selector-label">Estil</span>
                <span class="category-selector-value">Inici</span>
                ${CHEVRON}
            </button>
            <div class="category-selector-panel" role="listbox" aria-label="Estils musicals" hidden></div>
        `;
        bar.after(root);

        button = root.querySelector('.category-selector-btn');
        valueEl = root.querySelector('.category-selector-value');
        panel = root.querySelector('.category-selector-panel');

        button.addEventListener('click', togglePanel);
        panel.addEventListener('click', onOptionClick);
        document.addEventListener('click', event => {
            if (!root.contains(event.target)) closePanel();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closePanel();
        });

        // La barra es reconstrueix (cache, categories personalitzades, TV): ens hi sincronitzem.
        if (typeof MutationObserver === 'function') {
            new MutationObserver(updateValue).observe(bar, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class'],
            });
        }
        updateValue();
    }

    app.features.categorySelector = { init, updateValue };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
