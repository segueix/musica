import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

// js/vendor/ és al repositori (npm run vendor:sync) perquè la web funcioni servida tal qual, sense el paquet _site:
// el 2026-10-16 GitHub Pages servia una branca directament i index.html demanava js/vendor/*.js amb 404 (icones
// data-lucide buides, sense arrossegament ni QR).
const html = readFileSync('index.html', 'utf8');
const app = readFileSync('js/app.js', 'utf8');

const walk = dir =>
    readdirSync(dir).flatMap(name => {
        const file = join(dir, name);
        return statSync(file).isDirectory() ? (name === 'vendor' ? [] : walk(file)) : [file];
    });

const pascal = name =>
    name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

describe('llibreries del navegador a js/vendor', () => {
    it('cada script js/vendor que demana index.html (i el QR) existeix al repositori', () => {
        const scripts = [...html.matchAll(/src="(js\/vendor\/[^"?]+)/g)].map(match => match[1]);
        expect(scripts.length).toBeGreaterThanOrEqual(3);
        [...scripts, 'js/vendor/qr-code-styling.js', 'js/vendor/LICENSES.txt'].forEach(file =>
            expect(existsSync(file), file).toBe(true)
        );
    });

    it('lucide.js porta totes les icones data-lucide de l’HTML i del codi', () => {
        const ctx = { window: {}, document: { querySelectorAll: () => [] } };
        runInNewContext(readFileSync('js/vendor/lucide.js', 'utf8'), ctx);
        const icons = ctx.window.lucide?.icons || {};
        const sources = [
            html,
            ...walk('js')
                .filter(file => file.endsWith('.js'))
                .map(file => readFileSync(file, 'utf8')),
        ];
        const names = new Set(
            sources.flatMap(text => [...text.matchAll(/data-lucide="([a-z0-9-]+)"/g)].map(m => m[1]))
        );
        expect(names.size).toBeGreaterThan(5);
        const missing = [...names].filter(name => !icons[pascal(name)]);
        expect(missing, 'executa npm run vendor:sync').toEqual([]);
    });

    it('comentar i compartir de la fitxa de la cançó són SVG integrats (no depenen de lucide)', () => {
        const bar = app.slice(
            app.indexOf('<div class="video-metadata-bar">'),
            app.indexOf('// ==================== POSICIÓ DEL BOTÓ DE SUPORT')
        );
        expect(bar).toContain('btn-comment-youtube--desktop');
        expect(bar).toContain('id="shareBtn"');
        expect(bar).not.toContain('data-lucide');
        expect(bar.match(/<svg/g).length).toBeGreaterThanOrEqual(4);
    });
});
