#!/usr/bin/env node
// Incorpora a data/origens-artistes.json els enllaços del full de l'editor (2026-10-19,
// docs/revisions/2026-10-19-enllacos-full-editor.json): un per artista, sota officialLinks.website,
// .facebook o .instagram. L'artista es troba pel nom que es veu a l'app (displayName), el nom o els àlies de
// data/artistes-musica.json i els seus canals; si no, pel nom de la fitxa d'origen. Els artistes sense fitxa
// d'origen però amb canals tenen una entrada «només enllaç» (status: 'links-only') i els canals a linkChannels.
// Ús: node scripts/revisions/incorporar_enllacos_full_20261019.js [--dry-run]
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ORIGINS = path.join(ROOT, 'data/origens-artistes.json');
const RECORD = 'docs/revisions/2026-10-19-enllacos-full-editor.json';
const CHECKED_ON = '2026-10-19';
// La web de Mainasons promociona un casino en línia (revisat el 2026-10-19): l'editor hi va indicar el seu
// Instagram en lloc de la web del full.
const OVERRIDES = { 'artist:mainasons': 'https://www.instagram.com/mainasons/' };

const norm = value =>
    String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

const slug = value =>
    norm(value)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

// Classifica i neteja l'URL: Facebook i Instagram en forma canònica i sense paràmetres de seguiment.
function classify(raw) {
    const url = new URL(String(raw).trim());
    if (url.protocol !== 'https:') throw new Error('No és https: ' + raw);
    const host = url.hostname.toLowerCase().replace(/^(www|m|web)\./, '');
    if (host === 'facebook.com') {
        const id = url.pathname === '/profile.php' ? url.searchParams.get('id') : null;
        return {
            kind: 'facebook',
            url: `https://www.facebook.com${url.pathname}${id ? `?id=${id}` : ''}`,
        };
    }
    if (host === 'instagram.com') {
        const handle = url.pathname.split('/').filter(Boolean)[0];
        return { kind: 'instagram', url: `https://www.instagram.com/${handle}/` };
    }
    url.hash = '';
    return { kind: 'website', url: url.href };
}

function main() {
    const dryRun = process.argv.includes('--dry-run');
    const catalog = JSON.parse(fs.readFileSync(ORIGINS, 'utf8'));
    const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/artistes-musica.json'), 'utf8')).artists;
    const record = JSON.parse(fs.readFileSync(path.join(ROOT, RECORD), 'utf8'));
    catalog.linkChannels = catalog.linkChannels || {};
    const report = { added: [], skipped: [], noChannel: [], linksOnly: [], kinds: {} };

    for (const row of record.files) {
        if (!row.url) {
            report.skipped.push(`${row.artista} (sense enllaç)`);
            continue;
        }
        const name = norm(row.artista);
        const hits = base.filter(entry =>
            [entry.displayName, entry.name, ...(entry.aliases || [])].some(value => norm(value) === name)
        );
        const channelIds = hits.flatMap(entry => (entry.youtube?.channels || []).map(channel => channel.id));
        const keys = new Set(channelIds.map(id => catalog.channels[id]).filter(Boolean));
        if (!keys.size) {
            for (const [key, artist] of Object.entries(catalog.artists)) if (norm(artist.name) === name) keys.add(key);
        }
        if (keys.size > 1) {
            report.skipped.push(`${row.artista} (ambigu: ${[...keys].join(', ')})`);
            continue;
        }
        let key = [...keys][0];
        if (!key) {
            if (!channelIds.length) {
                report.skipped.push(`${row.artista} (no té cap canal a l'app)`);
                continue;
            }
            key = `artist:${slug(row.artista)}`;
            catalog.artists[key] = catalog.artists[key] || { name: row.artista, status: 'links-only' };
            for (const id of channelIds) catalog.linkChannels[id] = key;
            report.linksOnly.push(row.artista);
        }
        const override = OVERRIDES[key];
        const link = classify(override || row.url);
        const artist = catalog.artists[key];
        artist.officialLinks = {
            ...(artist.officialLinks || {}),
            [link.kind]: {
                url: link.url,
                status: 'verified',
                checkedOn: CHECKED_ON,
                method: 'editor-spreadsheet',
                sources: [RECORD],
                basis: override
                    ? "Instagram indicat per l'editor del catàleg en lloc de la web, que promociona un casino (19/10/2026)."
                    : "Enllaç facilitat per l'editor del catàleg al full d'artistes pendents (19/10/2026).",
            },
        };
        report.kinds[link.kind] = (report.kinds[link.kind] || 0) + 1;
        report.added.push(row.artista);
        if (!Object.values(catalog.channels).includes(key) && !Object.values(catalog.linkChannels).includes(key)) {
            report.noChannel.push(row.artista);
        }
    }

    // Un Facebook o Instagram desat abans com a «web» (p. ex. Nu Drama) passa al seu tipus
    const moved = [];
    for (const artist of Object.values(catalog.artists)) {
        const website = artist.officialLinks?.website;
        if (!website?.url) continue;
        const link = classify(website.url);
        if (link.kind === 'website' || artist.officialLinks[link.kind]) continue;
        artist.officialLinks[link.kind] = { ...website, url: link.url };
        delete artist.officialLinks.website;
        moved.push(artist.name);
    }
    if (moved.length) console.log(`Passen de «web» a Facebook/Instagram: ${moved.join(', ')}`);

    console.log(
        `Enllaços: ${report.added.length} (${Object.entries(report.kinds)
            .map(([kind, count]) => `${kind} ${count}`)
            .join(', ')}); només enllaç: ${report.linksOnly.join(', ') || 'cap'}`
    );
    console.log(`Sense canal a l'app encara (l'enllaç queda preparat): ${report.noChannel.length}`);
    console.log(`Omesos: ${report.skipped.join('; ') || 'cap'}`);
    if (!dryRun) fs.writeFileSync(ORIGINS, JSON.stringify(catalog, null, 2) + '\n');
}

main();
