// Dades de l'aplicació

const VIDEOS = [];

const CHANNELS = [];

const COMMENTS = [];

// Funcions d'utilitat per obtenir dades
function getVideoById(id) {
    return VIDEOS.find(v => v.id === parseInt(id));
}

function getChannelById(id) {
    return CHANNELS.find(c => c.id === parseInt(id));
}

function getCommentsByVideoId(videoId) {
    return COMMENTS.filter(c => c.videoId === parseInt(videoId));
}

function getVideosByCategory(categoryId) {
    return VIDEOS.filter(v => v.categoryId === parseInt(categoryId));
}

function formatViews(views) {
    if (views >= 1000000) {
        return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
        return `${(views / 1000).toFixed(1)}K`;
    }
    return views;
}

/**
 * Noms dels mesos abreviats per a mòbil
 */
const SHORT_MONTHS = [
    'gen.', 'febr.', 'març', 'abr.', 'maig', 'juny',
    'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'
];

/**
 * Formata una data de manera compacta per evitar salts de línia
 */
function formatDate(dateString) {
    if (!dateString) return '';

    const isoShortMatch = typeof dateString === 'string'
        ? dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        : null;
    const date = isoShortMatch
        ? new Date(Number(isoShortMatch[1]), Number(isoShortMatch[2]) - 1, Number(isoShortMatch[3]))
        : new Date(dateString);
    const now = new Date();

    const dateAtMidnightUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const nowAtMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const diffDays = Math.floor((nowAtMidnightUTC - dateAtMidnightUTC) / (1000 * 60 * 60 * 24));

    // Si la data és futura o error
    if (Number.isNaN(diffDays) || diffDays < 0) {
        const day = date.getUTCDate();
        const month = SHORT_MONTHS[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        return year === now.getUTCFullYear() ? `${day} ${month}` : `${day} ${month} ${year}`;
    }

    if (diffDays === 0) {
        // Data curta (sense hora): no podem calcular les hores, mantenim "Avui"
        if (isoShortMatch) return 'Avui';
        // Amb timestamp complet mostrem quantes hores fa (o minuts si fa menys d'una hora)
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours >= 1) return `Fa ${diffHours} h`;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes >= 1) return `Fa ${diffMinutes} min`;
        return 'Ara mateix';
    }
    if (diffDays === 1) return 'Ahir';
    if (diffDays >= 2 && diffDays <= 6) return `Fa ${diffDays} dies`;

    // Setmanes (Abreviat)
    if (diffDays >= 7 && diffDays <= 13) return 'Fa 1 setm.';
    if (diffDays >= 14 && diffDays <= 29) {
        return `Fa ${Math.floor(diffDays / 7)} setm.`;
    }

    // Mesos i Anys (Abreviat)
    const currentYear = now.getUTCFullYear();
    const videoYear = date.getUTCFullYear();

    // Si és del mateix any, mostrem dia i mes curt (Ex: "15 gen.")
    if (currentYear === videoYear) {
        const day = date.getUTCDate();
        const month = SHORT_MONTHS[date.getUTCMonth()];
        // Excepció: si fa menys d'un mes però salta de mes al calendari
        const monthsDiff = (now.getUTCMonth() - date.getUTCMonth());
        if (monthsDiff === 1 && diffDays < 45) return 'Fa 1 mes';
        return `${day} ${month}`;
    }

    // Si és d'anys anteriors (Ex: "15 gen. 23")
    const day = date.getUTCDate();
    const month = SHORT_MONTHS[date.getUTCMonth()];
    const shortYear = videoYear.toString().slice(-2); // "2023" -> "23"
    return `${day} ${month} ${shortYear}`;
}

/* --- NOVES FUNCIONS PER GESTIONAR L'ESBORRAT D'ETIQUETES --- */

// 1. Esborrar categoria personalitzada globalment (del llistat principal)
function deleteCustomCategoryGlobal(categoryName, options = {}) {
    const rawCategory = typeof categoryName === 'string' ? categoryName : '';
    const normalized = typeof normalizeCustomTag === 'function'
        ? normalizeCustomTag(rawCategory)
        : rawCategory.trim().replace(/^\"|\"$/g, '');

    if (!normalized) {
        return;
    }

    if (typeof removeCustomTag === 'function') {
        removeCustomTag(normalized);
    } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('catube_custom_tags');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const next = parsed.filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
                    localStorage.setItem('catube_custom_tags', JSON.stringify(next));
                }
            } catch (error) {
                console.warn('No es pot actualitzar catube_custom_tags', error);
            }
        }
    }

    // Netejar etiquetes (keywords) de la categoria eliminada
    if (typeof localStorage !== 'undefined') {
        try {
            const kwStored = localStorage.getItem('catube_category_keywords');
            if (kwStored) {
                const kwParsed = JSON.parse(kwStored) || {};
                let kwUpdated = false;
                for (const key of Object.keys(kwParsed)) {
                    if (key.toLowerCase() === normalized.toLowerCase()) {
                        delete kwParsed[key];
                        kwUpdated = true;
                    }
                }
                if (kwUpdated) {
                    localStorage.setItem('catube_category_keywords', JSON.stringify(kwParsed));
                    if (typeof invalidateCategoryKeywordsCache === 'function') {
                        invalidateCategoryKeywordsCache();
                    }
                }
            }
        } catch (error) {
            console.warn('No es pot actualitzar catube_category_keywords', error);
        }
    }

    const preserveChannelAssignments = options?.preserveChannelAssignments !== false;
    if (preserveChannelAssignments || typeof localStorage === 'undefined') {
        return;
    }

    const storedChannels = localStorage.getItem('catube_channel_custom_categories');
    if (!storedChannels) {
        return;
    }

    try {
        const parsed = JSON.parse(storedChannels) || {};
        let updated = false;
        Object.keys(parsed).forEach((channelId) => {
            if (!Array.isArray(parsed[channelId])) {
                return;
            }
            const filtered = parsed[channelId].filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
            if (filtered.length === 0) {
                delete parsed[channelId];
                updated = true;
            } else if (filtered.length !== parsed[channelId].length) {
                parsed[channelId] = filtered;
                updated = true;
            }
        });
        if (updated) {
            localStorage.setItem('catube_channel_custom_categories', JSON.stringify(parsed));
        }
    } catch (error) {
        console.warn('No es pot actualitzar catube_channel_custom_categories', error);
    }
}

// 2. Treure etiqueta d'un canal específic (del perfil)
function removeCategoryFromChannel(channelId, categoryName) {
    if (!channelId) {
        return;
    }
    const rawCategory = typeof categoryName === 'string' ? categoryName : '';
    const normalized = typeof normalizeCustomTag === 'function'
        ? normalizeCustomTag(rawCategory)
        : rawCategory.trim().replace(/^\"|\"$/g, '');

    if (!normalized) {
        return;
    }

    if (typeof getChannelCustomCategories === 'function' && typeof saveChannelCustomCategories === 'function') {
        const current = getChannelCustomCategories(channelId);
        const next = current.filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
        saveChannelCustomCategories(channelId, next);
        return;
    }

    if (typeof localStorage === 'undefined') {
        return;
    }
    const stored = localStorage.getItem('catube_channel_custom_categories');
    if (!stored) {
        return;
    }
    try {
        const parsed = JSON.parse(stored) || {};
        if (!Array.isArray(parsed[String(channelId)])) {
            return;
        }
        const next = parsed[String(channelId)].filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
        if (next.length === 0) {
            delete parsed[String(channelId)];
        } else {
            parsed[String(channelId)] = next;
        }
        localStorage.setItem('catube_channel_custom_categories', JSON.stringify(parsed));
    } catch (error) {
        console.warn('No es pot actualitzar catube_channel_custom_categories', error);
    }
}

