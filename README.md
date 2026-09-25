# Segueix

Aplicació web (PWA) per descobrir i seguir canals de YouTube en català, amb enfocament de rendiment, mantenibilitat i distribució simple (fitxers estàtics).

## Què és aquest projecte

**Segueix** és una aplicació client-side que:

- mostra un feed i un catàleg de canals,
- ofereix cerca i navegació per contingut,
- incorpora funcionalitats de biblioteca/likes i suport,
- i organitza la lògica en mòduls (`js/core`, `js/features`, `js/utils`) per facilitar l’evolució del codi.

## Estat actual

El repositori està en una fase de refactorització progressiva de `js/app.js` cap a una arquitectura modular.
Per entendre el context tècnic i el roadmap, consulta primer:

- `docs/refactor-appjs-plan.md`
- `docs/refactor-phase-2.md`
- `docs/app-architecture.md`

## Estructura principal

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js                 # punt d'entrada històric
│   ├── core/                  # nucli d'estat i coordinació
│   ├── features/              # funcionalitats per domini
│   ├── utils/                 # utilitats compartides
│   ├── config.js              # configuració global
│   ├── data.js                # càrrega i adaptació de dades
│   └── youtube.js             # integració YouTube
├── data/                      # feed, índexs de cerca i arxiu de canals
├── docs/                      # arquitectura, plans i validacions
├── scripts/                   # utilitats de manteniment de dades
└── tests/                     # proves amb Vitest
```

## Requisits

- Navegador modern per executar l’app.
- Node.js (recomanat 18+) només per eines de desenvolupament (lint/tests/scripts).

## Execució local

Opció ràpida (sense Node):

```bash
python -m http.server 8000
# obre http://localhost:8000
```

## Scripts de desenvolupament

```bash
npm install
npm run lint
npm run test
npm run search:index
```

Scripts disponibles (segons `package.json`):

- `lint` / `lint:fix`
- `format` / `format:check`
- `test` / `test:watch`
- `search:index`
- `search:index:hybrid:rebuild`

## Documentació recomanada

- Guia ràpida: `GUIA-RAPIDA.md`
- Arquitectura: `docs/app-architecture.md`
- Pla de refactor: `docs/refactor-appjs-plan.md`
- Estat fase 2: `docs/refactor-phase-2.md`
- Consentiment i YouTube: `docs/pla-consentiment-youtube.md`

## Flux de treball recomanat

1. Llegir documentació d’arquitectura/refactor.
2. Fer canvis petits i enfocats.
3. Executar `npm run lint` i `npm run test` abans de publicar.
4. Si es toca el pipeline de dades, revisar scripts de `scripts/` i fitxers de `data/`.

## Llicència

Si necessites una llicència explícita, afegeix un fitxer `LICENSE` al repositori.
