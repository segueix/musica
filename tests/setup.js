/**
 * Helper per carregar scripts globals (IIFEs / function declarations)
 * dins l'entorn de test de vitest (Node).
 *
 * Executa el fitxer font amb `globalThis` com a `window`,
 * de manera que les funcions globals i els namespaces SegueixApp
 * quedin accessibles.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Carrega un fitxer .js del projecte i retorna el context global resultant.
 * Les funcions declarades amb `function` al top-level queden com propietats del sandbox.
 */
export function loadScript(relativePath, extraGlobals = {}) {
    const filePath = resolve(ROOT, relativePath);
    const code = readFileSync(filePath, 'utf-8');

    const sandbox = {
        window: {},
        console,
        localStorage: createMockLocalStorage(),
        navigator: { userAgent: '', platform: '', maxTouchPoints: 0 },
        document: { createElement: () => ({ textContent: '', get innerHTML() { return this.textContent; } }) },
        Number,
        String,
        Array,
        Object,
        Math,
        JSON,
        parseInt,
        isNaN,
        encodeURIComponent,
        setTimeout,
        clearTimeout,
        requestIdleCallback: undefined,
        URLSearchParams,
        RegExp,
        Set,
        ...extraGlobals,
    };
    // Self-reference: window === sandbox
    sandbox.window = sandbox;
    // SegueixApp namespace init
    sandbox.SegueixApp = sandbox.SegueixApp || extraGlobals.SegueixApp || { state: {}, dom: {}, features: {}, utils: {} };
    sandbox.window.SegueixApp = sandbox.SegueixApp;

    runInNewContext(code, sandbox, { filename: filePath });

    return sandbox;
}

/**
 * Mock bàsic de localStorage per tests.
 */
export function createMockLocalStorage() {
    const store = new Map();
    return {
        getItem(key) { return store.has(key) ? store.get(key) : null; },
        setItem(key, value) { store.set(key, String(value)); },
        removeItem(key) { store.delete(key); },
        clear() { store.clear(); },
        get length() { return store.size; },
    };
}
