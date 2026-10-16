'use strict';

// Deixa a js/vendor/ les llibreries del navegador (lucide amb les icones que fa servir el codi, lz-string, Sortable,
// qr-code-styling i les llicències), les mateixes que genera el paquet estàtic (_site). Així la web també funciona
// servida tal qual des del repositori (GitHub Pages des d'una branca): abans index.html les demanava i donaven 404,
// i les icones data-lucide, l'arrossegament i els QR no funcionaven.
// Ús: npm run vendor:sync (torna-ho a fer si afegeixes una icona data-lucide nova).
const path = require('node:path');
const { writeVendor } = require('./optimitzar_web_estatica.cjs');

const root = path.resolve(__dirname, '..');
const icons = writeVendor(root, path.join(root, 'js', 'vendor'));
console.log(`js/vendor actualitzat: ${icons} icones de lucide, lz-string, Sortable i qr-code-styling.`);
