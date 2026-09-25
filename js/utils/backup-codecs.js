// ==================== BACKUP CODECS ====================
// Canal B — Exportació/importació manual per fitxers JSON
// NOTA: Aquest mòdul és EXCLUSIVAMENT per a còpia de seguretat manual (fitxers JSON).
//       La compartició ràpida via URL (Canal A) és a js/utils/share-codecs.js.
//
// Tres tipus de backup: playlists, categories, history
// Cada fitxer exportat conté metadades de versió i data.

(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.utils = app.utils || {};

    const BACKUP_VERSION = 1;

    // ==================== PLAYLISTS — BUILD ====================

    function buildPlaylistsBackup() {
        const stored = localStorage.getItem('catube_playlists');
        const playlists = stored ? JSON.parse(stored) : [];

        return {
            type: 'playlists',
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            items: playlists.map(function (pl) {
                return {
                    id: pl.id,
                    name: pl.name,
                    videos: (pl.videos || []).map(function (v) {
                        return {
                            id: v.id,
                            title: v.title || '',
                            thumbnail: v.thumbnail || '',
                            channelTitle: v.channelTitle || '',
                            channelId: v.channelId || '',
                            duration: v.duration || '',
                        };
                    }),
                };
            }),
        };
    }

    // ==================== CATEGORIES — BUILD ====================

    function buildCategoriesBackup() {
        const tagsStored = localStorage.getItem('catube_custom_tags');
        const customTags = tagsStored ? JSON.parse(tagsStored) : [];

        const channelCatsStored = localStorage.getItem('catube_channel_custom_categories');
        const channelCats = channelCatsStored ? JSON.parse(channelCatsStored) : {};

        const items = customTags.map(function (tagName) {
            const channels = [];
            for (const channelId in channelCats) {
                if (Array.isArray(channelCats[channelId]) && channelCats[channelId].includes(tagName)) {
                    channels.push(channelId);
                }
            }

            return {
                id: tagName,
                kind: channels.length > 0 ? 'smart' : 'custom',
                name: tagName,
                channels: channels,
                rules: {},
            };
        });

        return {
            type: 'categories',
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            items: items,
        };
    }

    // ==================== HISTORIAL — BUILD ====================

    function buildHistoryBackup() {
        const stored = localStorage.getItem('catube_history');
        const history = stored ? JSON.parse(stored) : [];

        return {
            type: 'history',
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            items: history.map(function (entry) {
                return {
                    id: entry.id,
                    title: entry.title || '',
                    thumbnail: entry.thumbnail || '',
                    channelId: entry.channelId || '',
                    channelTitle: entry.channelTitle || '',
                    viewedAt: entry.viewedAt || '',
                    duration: entry.duration || '',
                };
            }),
        };
    }

    // ==================== VALIDACIÓ ====================

    function validateBackup(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'No és un objecte vàlid' };
        }
        if (!data.type || !['playlists', 'categories', 'history'].includes(data.type)) {
            return { valid: false, error: 'Tipus no reconegut: ' + data.type };
        }
        if (typeof data.version !== 'number') {
            return { valid: false, error: 'Falta la versió del backup' };
        }
        if (!Array.isArray(data.items)) {
            return { valid: false, error: "Falta l'array d'items" };
        }
        return { valid: true };
    }

    // ==================== EXPORTACIÓ ====================

    // Descarrega un backup com a fitxer JSON
    function downloadBackup(backup, filename) {
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportPlaylists() {
        const backup = buildPlaylistsBackup();
        downloadBackup(backup, 'segueix-playlists.json');
        return backup;
    }

    function exportCategories() {
        const backup = buildCategoriesBackup();
        downloadBackup(backup, 'segueix-categories.json');
        return backup;
    }

    function exportHistory() {
        const backup = buildHistoryBackup();
        downloadBackup(backup, 'segueix-history.json');
        return backup;
    }

    // ==================== IMPORTACIÓ ====================

    // Importa playlists amb mode 'replace' o 'merge' (afegir sense duplicats)
    function importPlaylists(backup, mode) {
        const validation = validateBackup(backup);
        if (!validation.valid) return { success: false, error: validation.error };
        if (backup.type !== 'playlists') return { success: false, error: 'El fitxer no és de llistes' };

        if (mode === 'replace') {
            localStorage.setItem('catube_playlists', JSON.stringify(backup.items));
            return { success: true, count: backup.items.length, mode: 'replace' };
        }

        // Mode 'merge': afegir sense duplicats (per id, fallback per name)
        const stored = localStorage.getItem('catube_playlists');
        const existing = stored ? JSON.parse(stored) : [];
        let added = 0;

        for (const incoming of backup.items) {
            const duplicate = existing.find(function (e) {
                return e.id === incoming.id || e.name === incoming.name;
            });
            if (!duplicate) {
                existing.push(incoming);
                added++;
            }
        }

        localStorage.setItem('catube_playlists', JSON.stringify(existing));
        return { success: true, count: added, mode: 'merge', total: existing.length };
    }

    // Importa categories amb mode 'replace' o 'merge'
    function importCategories(backup, mode) {
        const validation = validateBackup(backup);
        if (!validation.valid) return { success: false, error: validation.error };
        if (backup.type !== 'categories') return { success: false, error: 'El fitxer no és de categories' };

        if (mode === 'replace') {
            // Reconstruir custom_tags i channel_custom_categories des dels items
            const tags = backup.items.map(function (item) { return item.name; });
            const channelCats = {};

            for (const item of backup.items) {
                if (Array.isArray(item.channels)) {
                    for (const channelId of item.channels) {
                        if (!channelCats[channelId]) channelCats[channelId] = [];
                        if (!channelCats[channelId].includes(item.name)) {
                            channelCats[channelId].push(item.name);
                        }
                    }
                }
            }

            localStorage.setItem('catube_custom_tags', JSON.stringify(tags));
            localStorage.setItem('catube_channel_custom_categories', JSON.stringify(channelCats));
            return { success: true, count: tags.length, mode: 'replace' };
        }

        // Mode 'merge': afegir categories noves sense duplicats (per id i name)
        const tagsStored = localStorage.getItem('catube_custom_tags');
        const existingTags = tagsStored ? JSON.parse(tagsStored) : [];

        const channelCatsStored = localStorage.getItem('catube_channel_custom_categories');
        const existingChannelCats = channelCatsStored ? JSON.parse(channelCatsStored) : {};

        let added = 0;

        for (const item of backup.items) {
            const isDuplicate = existingTags.some(function (t) {
                return t === item.name || t === item.id;
            });

            if (!isDuplicate) {
                existingTags.push(item.name);
                added++;
            }

            // Afegir assignacions de canals (sempre, per si el tag ja existia però li falten canals)
            if (Array.isArray(item.channels)) {
                for (const channelId of item.channels) {
                    if (!existingChannelCats[channelId]) existingChannelCats[channelId] = [];
                    if (!existingChannelCats[channelId].includes(item.name)) {
                        existingChannelCats[channelId].push(item.name);
                    }
                }
            }
        }

        localStorage.setItem('catube_custom_tags', JSON.stringify(existingTags));
        localStorage.setItem('catube_channel_custom_categories', JSON.stringify(existingChannelCats));
        return { success: true, count: added, mode: 'merge', total: existingTags.length };
    }

    // Importa historial amb mode 'replace' o 'merge'
    function importHistory(backup, mode) {
        const validation = validateBackup(backup);
        if (!validation.valid) return { success: false, error: validation.error };
        if (backup.type !== 'history') return { success: false, error: 'El fitxer no és d\'historial' };

        if (mode === 'replace') {
            localStorage.setItem('catube_history', JSON.stringify(backup.items));
            return { success: true, count: backup.items.length, mode: 'replace' };
        }

        // Mode 'merge': afegir sense duplicats per videoId
        const stored = localStorage.getItem('catube_history');
        const existing = stored ? JSON.parse(stored) : [];
        const existingIds = new Set(existing.map(function (e) { return e.id; }));
        let added = 0;

        for (const incoming of backup.items) {
            if (!existingIds.has(incoming.id)) {
                existing.push(incoming);
                existingIds.add(incoming.id);
                added++;
            }
        }

        localStorage.setItem('catube_history', JSON.stringify(existing));
        return { success: true, count: added, mode: 'merge', total: existing.length };
    }

    // ==================== UI — REGISTRE D'EVENTS ====================

    // Estat intern per saber quin tipus de fitxer estem important
    let _pendingImportType = null;

    function _showImportModeModal(backupData) {
        const typeLabels = { playlists: 'Llistes', categories: 'Categories', history: 'Historial' };
        const typeLabel = typeLabels[backupData.type] || backupData.type;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'importModeModal';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title">Importar ${typeLabel}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p style="margin-bottom:8px; font-size:0.9rem;">Fitxer: <strong>${typeLabel}</strong> — ${backupData.items.length} elements</p>
                    <p style="margin-bottom:8px; font-size:0.8rem; opacity:0.6;">Exportat: ${backupData.exportedAt ? new Date(backupData.exportedAt).toLocaleString('ca-ES') : 'desconegut'}</p>
                    <p style="margin-bottom:20px; font-size:0.9rem;">Com vols importar?</p>
                    <div style="display:flex; gap:10px; justify-content:center;">
                        <button class="hero-button" id="importModeReplace" style="background:#e74c3c;">Substituir</button>
                        <button class="hero-button" id="importModeMerge">Afegir</button>
                    </div>
                    <p style="margin-top:15px; font-size:0.75rem; opacity:0.5; text-align:center;">
                        <strong>Substituir</strong> reemplaça totes les dades actuals. <strong>Afegir</strong> combina sense duplicats.
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof refreshIcons === 'function') refreshIcons(modal);

        const importFunctions = {
            playlists: importPlaylists,
            categories: importCategories,
            history: importHistory,
        };
        const importFn = importFunctions[backupData.type];

        modal.querySelector('#importModeReplace').addEventListener('click', function () {
            const result = importFn(backupData, 'replace');
            modal.remove();
            _showImportResult(result, typeLabel);
        });

        modal.querySelector('#importModeMerge').addEventListener('click', function () {
            const result = importFn(backupData, 'merge');
            modal.remove();
            _showImportResult(result, typeLabel);
        });
    }

    function _showImportResult(result, typeLabel) {
        if (result.success) {
            const modeText = result.mode === 'replace' ? 'substituïts' : 'afegits';
            const msg =
                result.mode === 'replace'
                    ? `✔ ${typeLabel}: ${result.count} elements importats (substituïts)`
                    : `✔ ${typeLabel}: ${result.count} elements ${modeText} (total: ${result.total})`;
            showConfigFeedback('importFeedback', msg, 'success');
        } else {
            showConfigFeedback('importFeedback', 'Error: ' + result.error, 'error');
        }
    }

    function _handleBackupFileInput(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Capturem el tipus esperat ABANS de la lectura async
        const expectedType = _pendingImportType;
        _pendingImportType = null;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                const validation = validateBackup(data);

                if (!validation.valid) {
                    showConfigFeedback('importFeedback', 'Fitxer no vàlid: ' + validation.error, 'error');
                    return;
                }

                // Comprovar que el tipus coincideix amb el que l'usuari ha demanat
                if (expectedType && data.type !== expectedType) {
                    const typeLabels = { playlists: 'Llistes', categories: 'Categories', history: 'Historial' };
                    showConfigFeedback(
                        'importFeedback',
                        `Tipus incorrecte: has seleccionat un fitxer de ${typeLabels[data.type] || data.type} però esperava ${typeLabels[expectedType] || expectedType}.`,
                        'error'
                    );
                    return;
                }

                _showImportModeModal(data);
            } catch (err) {
                showConfigFeedback('importFeedback', 'Fitxer no vàlid. Ha de ser un JSON correcte.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function _triggerImport(type) {
        _pendingImportType = type;
        hideConfigFeedback('importFeedback');
        const input = document.getElementById('backupFileInput');
        if (input) input.click();
    }

    function register() {
        // No hi ha controls addicionals a registrar en aquest mòdul.
    }

    app.utils.backupCodecs = {
        buildPlaylistsBackup,
        buildCategoriesBackup,
        buildHistoryBackup,
        validateBackup,
        exportPlaylists,
        exportCategories,
        exportHistory,
        importPlaylists,
        importCategories,
        importHistory,
        register,
    };
})(window);
