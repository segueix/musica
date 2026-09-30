import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const navigationSource = readFileSync(new URL('../js/features/navigation.js', import.meta.url), 'utf8');
const feedSource = readFileSync(new URL('../js/features/feed.js', import.meta.url), 'utf8');
const playerSource = readFileSync(new URL('../js/features/player.js', import.meta.url), 'utf8');

describe('context de Continua mirant a la portada', () => {
    it('no renderitza la fila Continua mirant dins dels feeds', () => {
        expect(playerSource).toContain("section?.remove?.();");
        expect(playerSource).toContain("return null;");
        expect(playerSource).not.toContain("hero.before(section);");
    });

    it('manté visible la capçalera de categoria encara que hi hagi Continua mirant', () => {
        expect(navigationSource).not.toContain('installContinueWatchingRecommendationSwitch');
        expect(navigationSource).not.toContain("hero?.classList?.toggle?.('continue-watching-recommendation-hidden'");
        expect(feedSource).toContain("classList?.remove?.(\n            'continue-watching-page-title-hidden'");
        expect(feedSource).not.toContain(".continue-watching-page-title-hidden{display:none!important}");
        expect(feedSource).toContain('hasVisiblePending');
    });

    it('no mostra Continua mirant a Novetats i filtra les categories per assignació explícita', () => {
        expect(feedSource).toContain("normalizedCategory === 'novetats') return false");
        expect(feedSource).toContain('collectVideoCategories(getKnownVideo(videoId)).has(normalizedCategory)');
        expect(feedSource).toContain("window.getChannelCustomCategories?.(channelId)");
        expect(feedSource).toContain("window.getEffectiveCategory?.(channelId)");
    });

    it('limita la fila a tres vídeos visibles per secció', () => {
        expect(feedSource).toContain('const CONTINUE_WATCHING_SECTION_LIMIT = 3');
        expect(feedSource).toContain('visibleCards < CONTINUE_WATCHING_SECTION_LIMIT');
    });

    it('té Continua mirant activat per defecte i usa un toggle com YouTube Premium', () => {
        expect(feedSource).toContain("const CONTINUE_WATCHING_ENABLED_KEY = 'catube_continue_watching_enabled'");
        expect(feedSource).toContain("getItem?.(CONTINUE_WATCHING_ENABLED_KEY) !== '0'");
        expect(feedSource).toContain("id = 'continueWatchingSettingsSection'");
        expect(feedSource).toContain('class="toggle-switch" for="toggleContinueWatchingBtn"');
        expect(feedSource).toContain('type="checkbox" id="toggleContinueWatchingBtn"');
        expect(feedSource).toContain("toggle?.addEventListener?.('change'");
        expect(feedSource).toContain('toggle.checked = isContinueWatchingEnabled()');
    });

    it('posa la roda dentada just al costat del títol i obre Configuració centrada', () => {
        expect(feedSource).toContain("button.dataset.continueSettings = 'true'");
        expect(feedSource).toContain("'Configura Continua mirant'");
        expect(feedSource).toContain("document?.getElementById?.('backgroundBtn')?.click?.()");
        expect(feedSource).toContain("section.scrollIntoView?.({ behavior: 'smooth', block: 'center'");
        expect(feedSource).toContain("toggle?.focus?.({ preventScroll: true })");
        expect(feedSource).toContain('#continueWatchingSection .continue-watching-header{justify-content:flex-start}');
        expect(feedSource).toContain('margin-left:6px');
    });

    it('fa pampalluguejar el marc blanc fins que es clica la secció', () => {
        expect(feedSource).toContain('animation:continueWatchingTargetBlink');
        expect(feedSource).toContain('@keyframes continueWatchingTargetBlink');
        expect(feedSource).toContain("section.addEventListener?.('click'");
        expect(feedSource).toContain("section.classList?.remove?.('continue-watching-settings-target')");
        expect(feedSource).not.toContain('}, 1400);');
    });

    it('afegeix el botó TV al costat de Configuració quan Continua mirant és visible', () => {
        expect(feedSource).toContain('syncContinueWatchingTVShortcut');
        expect(feedSource).toContain("button.dataset.contextTv = 'category'");
        expect(feedSource).toContain("button.dataset.continueTv = 'true'");
        expect(feedSource).toContain('syncContinueWatchingTVShortcut(section, category, hasVisiblePending)');
    });

    it('reacciona als canvis de categoria i als re-renders de la fila', () => {
        expect(feedSource).toContain("event.target?.closest?.('.chip[data-cat]')");
        expect(feedSource).toContain('new window.MutationObserver');
        expect(feedSource).toContain('scheduleContinueWatchingContextSync');
    });
});
