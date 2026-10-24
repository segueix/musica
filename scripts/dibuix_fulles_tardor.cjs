#!/usr/bin/env node
'use strict';

// Dibuix del fons de la «Ràdio de tardor» (img/fulles-tardor.svg), triat per l'usuari el 24/10/2026 (A5-3): set
// aurons grans a l'aquarel·la (vores irregulars, color que es difumina, nervis clars) en un mosaic de 600 × 600 que
// es repeteix sense talls, sobre el fons cacau del CSS. La fulla horitzontal (270°) va una mica inclinada (300°).
//
//   node scripts/dibuix_fulles_tardor.cjs

const fs = require('node:fs');
const path = require('node:path');

// ---------- L'auró, dibuixat a mà: meitat dreta i mirall (quadre de 100 × 100, pecíol a baix) ----------
const TOP = [50, 3];
const RIGHT = [
    ['L', [54, 12]],
    ['L', [58, 10]],
    ['L', [57.5, 18]],
    ['L', [61, 17.5]],
    ['L', [59.5, 28]],
    ['Q', [62, 37], [66, 33]],
    ['L', [69, 26]],
    ['L', [72, 29]],
    ['L', [79, 22]],
    ['L', [81, 26]],
    ['L', [94, 23]],
    ['L', [87, 33]],
    ['L', [90, 37]],
    ['L', [82, 40]],
    ['L', [84, 45]],
    ['L', [76, 46]],
    ['Q', [68, 50], [75, 54]],
    ['L', [80, 54]],
    ['L', [78, 59]],
    ['L', [85, 67]],
    ['L', [75, 65]],
    ['L', [72, 69]],
    ['L', [66, 64]],
    ['Q', [58, 69], [50, 71]],
];
const f = p => `${p[0]} ${p[1]}`;
const mirror = p => [+(100 - p[0]).toFixed(2), p[1]];
function build() {
    let d = `M${f(TOP)}`;
    for (const s of RIGHT) d += s[0] === 'L' ? ` L${f(s[1])}` : ` Q${f(s[1])} ${f(s[2])}`;
    // Tornada per l'esquerra: els mateixos trams al revés i en mirall
    const ends = [TOP, ...RIGHT.map(s => (s[0] === 'L' ? s[1] : s[2]))];
    for (let i = RIGHT.length - 1; i >= 0; i--) {
        const s = RIGHT[i];
        const to = mirror(ends[i]);
        d += s[0] === 'L' ? ` L${f(to)}` : ` Q${f(mirror(s[1]))} ${f(to)}`;
    }
    return d + ' Z';
}
const BASE = [50, 69];
const tips = [
    [50, 7],
    [91, 24.5],
    [82, 65],
];
const both = arr => arr.flatMap(p => (p[0] === 50 ? [p] : [p, mirror(p)]));
const main = both(tips)
    .map(t => `M${f(BASE)} L${f(t)}`)
    .join(' ');
const subPairs = [
    [
        [50, 38],
        [57, 26],
    ],
    [
        [50, 24],
        [55, 15],
    ],
    [
        [70, 47],
        [72, 34],
    ],
    [
        [70, 47],
        [82, 41],
    ],
    [
        [78, 37],
        [80, 28],
    ],
    [
        [62, 67.5],
        [70, 60],
    ],
    [
        [72, 66],
        [78, 59],
    ],
];
const sub = subPairs
    .flatMap(([a, b]) => [
        [a, b],
        [mirror(a), mirror(b)],
    ])
    .filter((x, i, arr) => !(x[0][0] === 50 && i % 2 === 1 && x[1][0] === mirror(arr[i - 1][1])[0] && false))
    .map(([a, b]) => `M${f(a)} L${f(b)}`)
    .join(' ');
const stem = `M${f(BASE)} Q52 84 48 98`;
const L = { d: build(), main, sub, stem, BASE };

// ---------- Mosaic ----------
const BG = '#7a5236';
const PALETTE = ['#c2410c', '#ea580c', '#d97706', '#b45309', '#9a3412'];
const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v =>
        Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))))
    );
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
};
function rng(seed) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
// La mateixa composició que el mosaic A: set aurons grans
function layout(T = 600) {
    const r = rng(7),
        placed = [],
        leaves = [];
    for (let n = 0; n < 7; n++) {
        const size = 170 + r() * 60;
        let x,
            y,
            t = 0;
        do {
            x = r() * T;
            y = r() * T;
            t++;
        } while (
            t < 400 &&
            placed.some(p => {
                const dx = Math.min(Math.abs(p.x - x), T - Math.abs(p.x - x)),
                    dy = Math.min(Math.abs(p.y - y), T - Math.abs(p.y - y));
                return Math.hypot(dx, dy) < (p.s + size) * 0.42;
            })
        );
        placed.push({ x, y, s: size });
        leaves.push({ x, y, size, color: PALETTE[Math.floor(r() * PALETTE.length)], rot: Math.round(r() * 360), i: n });
    }
    return leaves;
}
function copies(l, T, draw) {
    const out = [];
    for (const ox of [-T, 0, T])
        for (const oy of [-T, 0, T]) {
            const cx = l.x + ox,
                cy = l.y + oy,
                h = l.size * 0.75;
            if (cx + h < 0 || cx - h > T || cy + h < 0 || cy - h > T) continue;
            const s = l.size / 100;
            out.push(
                `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${l.rot}) scale(${s.toFixed(3)}) translate(-50 -50)">${draw(l, s)}</g>`
            );
        }
    return out.join('\n');
}
const AQUARELLA = {
    // Aquarel·la: vores irregulars, color que es difumina i nervis clars
    defs: () =>
        `<filter id="aq" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.6"/></filter>` +
        PALETTE.map(
            (c, i) =>
                `<radialGradient id="r${i}" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="${shade(c, 0.35)}" stop-opacity=".95"/><stop offset=".7" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${shade(c, -0.3)}" stop-opacity=".85"/></radialGradient>`
        ).join(''),
    draw: (l, s) => {
        const i = PALETTE.indexOf(l.color);
        return `<g filter="url(#aq)"><path d="${L.d}" fill="url(#r${i})"/><path d="${L.main}" fill="none" stroke="${shade(l.color, 0.45)}" stroke-width="${((1 / s) * 1.6).toFixed(2)}" stroke-linecap="round" opacity=".7"/></g><path d="${L.stem}" fill="none" stroke="${shade(l.color, -0.3)}" stroke-width="${((1.2 / s) * 1.6).toFixed(2)}" stroke-linecap="round"/>`;
    },
};

const leaves = layout();
// Petició de l'usuari: la fulla de la dreta (l'auró horitzontal, 270°) una mica inclinada
for (const l of leaves) if (l.rot === 270) l.rot = 300;
const body = leaves.map(l => copies(l, 600, AQUARELLA.draw)).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
<!-- Fulles de tardor (aurons a l'aquarel·la) per al fons de la «Ràdio de tardor» d'Inici (css/portada.css,
     la classe pt-season amb el tema tardor). Mosaic que es repeteix sense talls. El fons cacau el posa el CSS.
     Generat per scripts/dibuix_fulles_tardor.cjs: no l'editis a mà. -->
<defs>${AQUARELLA.defs()}</defs>
${body}
</svg>
`;
fs.writeFileSync(path.join(__dirname, '..', 'img/fulles-tardor.svg'), svg);
console.log('img/fulles-tardor.svg');
