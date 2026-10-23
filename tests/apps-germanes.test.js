import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Apps germanes (2026-10-23): a Chrome d'ordinador, passar de Música a segueix.cat (i a l'inrevés) des de l'app
// instal·lada no mostra la franja «fora de l'app» (scope_extensions + .well-known/web-app-origin-association).
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const association = JSON.parse(readFileSync('.well-known/web-app-origin-association', 'utf8'));

describe('apps germanes sense franja a l’ordinador', () => {
    it('el manifest amplia l’abast a segueix.cat sense canviar la identitat de l’app', () => {
        expect(manifest.scope_extensions).toEqual([{ type: 'origin', origin: 'https://segueix.cat' }]);
        expect(manifest.id).toBeUndefined();
        expect(manifest.start_url).toBe('./');
    });

    it('autoritza l’app de segueix.cat en els dos formats del fitxer', () => {
        expect(association['https://segueix.cat/']).toEqual({ scope: '/' });
        expect(association.web_apps).toEqual([{ web_app_identity: 'https://segueix.cat/' }]);
    });

    it('el paquet estàtic copia .well-known i en serveix el JSON', () => {
        const generator = readFileSync('scripts/generar_web_estatica.cjs', 'utf8');
        expect(generator).toContain("fs.cpSync(path.join(root, '.well-known')");
        expect(generator).toContain('/.well-known/web-app-origin-association\\n  Content-Type: application/json');
    });
});
