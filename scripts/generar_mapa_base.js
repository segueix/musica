// Genera data/mapa-base.json: el contorn dels Països Catalans (i el context veí) en coordenades de l'SVG del mapa
// d'artistes, i la projecció per situar-hi qualsevol coordenada. Només cal tornar-lo a executar si canvia el dibuix
// del mapa: els artistes s'hi posen sols a l'app (js/features/artist-map.js) amb data/origens-artistes.json.
//
// Font: Natural Earth, ne_10m_admin_1_states_provinces (domini públic).
//   curl -L -o /tmp/admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
//   node scripts/generar_mapa_base.js /tmp/admin1.geojson
const fs = require('node:fs');
const path = require('node:path');

const MAIN = { lonMin: -1.75, lonMax: 4.45, latMin: 37.7, latMax: 43.0, width: 1000 };
// Sardenya sencera (amb l'Alguer), en un requadre al mar a baix a la dreta. L'illa no hi cap a l'escala del mapa
// principal: va a una escala més petita (factor), amb un marge (pad) i una franja a baix per al nom (label). El
// requadre acaba a right/bottom de l'SVG (a l'ordinador, els botons de zoom són a la dreta de x ≈ 990).
const INSET = { lonMin: 8.05, lonMax: 9.9, latMin: 38.8, latMax: 41.33, factor: 0.33, pad: 10, label: 22 };
const INSET_RIGHT = 975;
const INSET_BOTTOM = 1112;
const TERRITORIES = {
    'ES-B': 'Catalunya',
    'ES-GI': 'Catalunya',
    'ES-L': 'Catalunya',
    'ES-T': 'Catalunya',
    'ES-CS': 'País Valencià',
    'ES-V': 'País Valencià',
    'ES-A': 'País Valencià',
    'ES-PM': 'Illes Balears',
    'FR-66': 'Catalunya Nord',
    'AD-02': 'Andorra',
    'AD-03': 'Andorra',
    'AD-04': 'Andorra',
    'AD-05': 'Andorra',
    'AD-06': 'Andorra',
    'AD-07': 'Andorra',
    'AD-08': 'Andorra',
};
const CONTEXT = new Set(['ES-HU', 'ES-Z', 'ES-TE', 'ES-CU', 'ES-AB', 'ES-MU', 'FR-11', 'FR-09', 'FR-31']);

const lat0 = ((MAIN.latMin + MAIN.latMax) / 2) * (Math.PI / 180);
const kx = Math.cos(lat0);
const scale = MAIN.width / ((MAIN.lonMax - MAIN.lonMin) * kx);
const height = Math.round((MAIN.latMax - MAIN.latMin) * scale);
const projectMain = ([lon, lat]) => [(lon - MAIN.lonMin) * kx * scale, (MAIN.latMax - lat) * scale];
const insetScale = scale * INSET.factor;
const insetW = Math.round((INSET.lonMax - INSET.lonMin) * kx * insetScale + 2 * INSET.pad);
const insetH = Math.round((INSET.latMax - INSET.latMin) * insetScale + 2 * INSET.pad + INSET.label);
const insetX = INSET_RIGHT - insetW;
const insetY = INSET_BOTTOM - insetH;
// Origen de les coordenades dins el requadre (cantonada nord-oest de l'àrea geogràfica)
const insetX0 = insetX + INSET.pad;
const insetY0 = insetY + INSET.pad;
const projectInset = ([lon, lat]) => [
    insetX0 + (lon - INSET.lonMin) * kx * insetScale,
    insetY0 + (INSET.latMax - lat) * insetScale,
];

// Douglas-Peucker sobre punts ja projectats (tolerància en píxels de l'SVG)
function simplify(points, tolerance) {
    if (points.length < 4) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const [a, b] = stack.pop();
        const [ax, ay] = points[a];
        const [bx, by] = points[b];
        const dx = bx - ax,
            dy = by - ay;
        const len = Math.hypot(dx, dy);
        let max = 0,
            index = -1;
        for (let i = a + 1; i < b; i++) {
            // Un anell tancat comença i acaba al mateix punt: llavors es mesura la distància a aquest punt
            const d = len
                ? Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len
                : Math.hypot(points[i][0] - ax, points[i][1] - ay);
            if (d > max) {
                max = d;
                index = i;
            }
        }
        if (max > tolerance && index > 0) {
            keep[index] = 1;
            stack.push([a, index], [index, b]);
        }
    }
    return points.filter((_, i) => keep[i]);
}
const round = n => Math.round(n * 10) / 10;
function ringPath(ring, project) {
    const points = simplify(ring.map(project), 0.9);
    if (points.length < 3) return '';
    return 'M' + points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L') + 'Z';
}
function featurePath(geometry, project, keep = () => true) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons
        .filter(polygon => keep(polygon[0]))
        .map(polygon => polygon.map(ring => ringPath(ring, project)).join(''))
        .join('');
}

function generate(source) {
    const geo = JSON.parse(fs.readFileSync(source, 'utf8'));
    const shapes = [];
    let alguer = '';
    for (const feature of geo.features) {
        const code = feature.properties.iso_3166_2;
        if (TERRITORIES[code] || CONTEXT.has(code)) {
            shapes.push({
                id: code,
                territory: TERRITORIES[code] || '',
                kind: TERRITORIES[code] ? 'pc' : 'context',
                d: featurePath(feature.geometry, projectMain),
            });
        }
        // Sardenya sencera (totes les províncies de la regió), dins el requadre
        if (feature.properties.region === 'Sardegna') {
            alguer += featurePath(feature.geometry, projectInset);
        }
    }
    return {
        _ajuda: 'Generat per scripts/generar_mapa_base.js (Natural Earth, domini públic). No l’editis a mà.',
        viewBox: [0, 0, MAIN.width, height],
        projection: { ...MAIN, kx: Math.round(kx * 1e6) / 1e6, scale: Math.round(scale * 1000) / 1000 },
        inset: {
            lonMin: INSET.lonMin,
            lonMax: INSET.lonMax,
            latMin: INSET.latMin,
            latMax: INSET.latMax,
            x: insetX,
            y: insetY,
            width: insetW,
            height: insetH,
            x0: insetX0,
            y0: insetY0,
            scale: Math.round(insetScale * 1000) / 1000,
            label: "l'Alguer",
            d: alguer,
        },
        shapes,
    };
}

module.exports = { generate, simplify };
if (require.main === module) {
    const source = process.argv[2];
    if (!source) {
        console.error('Ús: node scripts/generar_mapa_base.js <ne_10m_admin_1_states_provinces.geojson>');
        process.exit(1);
    }
    const out = path.join(__dirname, '..', 'data', 'mapa-base.json');
    const data = generate(source);
    fs.writeFileSync(out, JSON.stringify(data));
    console.log(`${out}: ${data.shapes.length} formes, ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
