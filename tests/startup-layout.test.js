import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { loadScript, createMockLocalStorage } from './setup.js';

const html = readFileSync('index.html', 'utf8');
const early = html.match(/<script id="earlyRadioLayout">([\s\S]*?)<\/script>/)[1];
const chips = [...html.matchAll(/<button[^>]*data-pt-first-style="([^"]+)"[^>]*>/g)];
const labels = chips.map(match => match[1].replaceAll('&#x27;', "'"));
function layout(values = {}, blocked = false) {
    const storage = createMockLocalStorage();
    for (const [key, value] of Object.entries(values)) storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    if (blocked) storage.getItem = () => { throw Error('Storage blocked'); };
    const elements = Object.fromEntries(['portadaEntry', 'ptFirst', 'ptFirstReset', 'ptRadioLead'].map(id => [id, { hidden: false, textContent: '', classList: { toggle() {} } }]));
    const mode = {};
    vm.runInNewContext(early, { localStorage: storage, Date, document: {
        querySelectorAll: () => labels.map(label => ({ dataset: { ptFirstStyle: label } })),
        getElementById: id => elements[id], querySelector: () => mode,
    } });
    const app = { features: {} };
    loadScript('js/features/discovery.js', { SegueixApp: app, localStorage: storage });
    loadScript('js/features/portada.js', { SegueixApp: app });
    const array = key => { try { const raw = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(raw) ? raw : []; } catch { return []; } };
    const expected = app.features.portada.firstTimeState(app.features.discovery.recentTaste({
        history: array('catube_history'), liked: array('catube_liked_videos'), followedIds: array('catube_follows'),
    }));
    return { elements, mode, expected, discovery: app.features.discovery };
}

describe('disseny inicial abans dels scripts diferits', () => {
    it.each([
        {},
        { catube_first_styles: ['rock', 'Rock', 'Pop', 'Estil inexistent'] },
        { catube_follows: ['a', 'b', 'c'] },
        { catube_liked_videos: [{ id: 'a', channelId: 'A' }], catube_first_styles: ['Rock'] },
        { catube_history: [{ id: 'a', isShort: true }], catube_first_styles: [] },
        { catube_history: [{ id: 'a', channelId: 'A' }, { id: 'b', channelId: 'B' }, { id: 'c', channelId: 'C' }], catube_first_styles: ['Rock'] },
        { catube_history: '{broken', catube_first_styles: { invalid: true } },
    ])('la disposició coincideix amb la lògica de portada: %j', values => {
        const { elements, mode, expected } = layout(values);
        expect(elements.ptFirst.hidden).toBe(!expected.chooser);
        expect(elements.ptFirstReset.hidden).toBe(!expected.savedOnly);
        expect(mode.hidden).toBe(expected.chooser || expected.savedOnly);
    });

    it('respecta l’emmagatzematge bloquejat i conserva el selector de primera visita', () => {
        const { elements, mode } = layout({}, true);
        expect(elements.ptFirst.hidden).toBe(false);
        expect(mode.hidden).toBe(true);
    });

    it('l’HTML inicial conté tots els estils vigents, amb els secundaris plegats', () => {
        const { discovery } = layout();
        expect(labels).toEqual(discovery.choosableStyles());
        for (const [i, chip] of chips.entries()) {
            expect(chip[0]).toContain(' disabled');
            expect(chip[0].includes(' hidden')).toBe(!discovery.PRIMARY_STYLES.includes(labels[i]));
        }
    });

    it('declara les fonts amb optional al CSS inicial, sense aplicar un full extern tardà', () => {
        expect(html).not.toContain('fonts.googleapis.com');
        expect(html).toContain('id="robotoTypographyWeights"');
        const css = readFileSync('css/styles.css', 'utf8');
        const faces = css.match(/@font-face\s*\{[^}]+\}/g);
        expect(faces.length).toBeGreaterThanOrEqual(2);
        for (const face of faces) expect(face).toContain('font-display: optional;');
        expect(faces.join('')).toContain("font-family: 'Fraunces'");
        expect(faces.join('')).toContain("font-family: 'Roboto'");
    });
});
