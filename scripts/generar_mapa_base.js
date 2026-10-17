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
// L'Alguer, a la mateixa escala que el mapa, en un requadre a la cantonada de baix a la dreta: arriba fins a la vora
// dreta i la de baix del mapa (només se'n veuen les línies de dalt i de l'esquerra) i comença prou a l'oest i al
// nord perquè cap línia no talli l'illa. El nord de Sardenya que hi cau es retalla al requadre (clipPath, a l'app).
const INSET = { lonMin: 7.98, latMax: 41.36, width: 210, height: 210 };
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
const insetX = MAIN.width - INSET.width;
const insetY = height - INSET.height;
const insetLonMax = INSET.lonMin + INSET.width / (kx * scale);
const insetLatMin = INSET.latMax - INSET.height / scale;
const projectInset = ([lon, lat]) => [insetX + (lon - INSET.lonMin) * kx * scale, insetY + (INSET.latMax - lat) * scale];

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
        // Les províncies de Sardenya que entren al requadre (l'app les retalla a la seva vora)
        if (feature.properties.region === 'Sardegna') {
            alguer += featurePath(feature.geometry, projectInset, ring =>
                ring.some(
                    ([lon, lat]) => lon >= INSET.lonMin && lon <= insetLonMax && lat >= insetLatMin && lat <= INSET.latMax
                )
            );
        }
    }
    return {
        _ajuda: 'Generat per scripts/generar_mapa_base.js (Natural Earth, domini públic). No l’editis a mà.',
        viewBox: [0, 0, MAIN.width, height],
        projection: { ...MAIN, kx: Math.round(kx * 1e6) / 1e6, scale: Math.round(scale * 1000) / 1000 },
        inset: {
            lonMin: INSET.lonMin,
            lonMax: Math.round(insetLonMax * 1000) / 1000,
            latMin: Math.round(insetLatMin * 1000) / 1000,
            latMax: INSET.latMax,
            x: insetX,
            y: insetY,
            width: INSET.width,
            height: INSET.height,
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
