'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data', 'artistes-musica.json');
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const WIKIDATA_RE = /^Q\d+$/;
const MUSICBRAINZ_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIDENCE = new Set(['alta', 'mitjana', 'baixa', 'pendent']);
const REVIEW = new Set(['pendent', 'aprovat', 'rebutjat']);
const CHANNEL_TYPES = new Set(['official', 'topic', 'label', 'other']);
const TAXONOMY = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'music-genres.json'), 'utf8'));
const GENRES = new Set(TAXONOMY.categories.map((category) => category.label));

function fail(message) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
}

function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

let data;
try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (error) {
    console.error(`❌ No s'ha pogut llegir ${FILE}: ${error.message}`);
    process.exit(1);
}

if (data.schemaVersion !== 1) fail('schemaVersion ha de ser 1.');
if (!(data.updatedAt === null || typeof data.updatedAt === 'string')) fail('updatedAt ha de ser null o una data ISO.');
if (!Array.isArray(data.artists)) {
    fail('artists ha de ser un array.');
} else {
    const names = new Set();
    const qids = new Set();

    data.artists.forEach((artist, index) => {
        const where = `artists[${index}]`;
        if (!artist || typeof artist !== 'object' || Array.isArray(artist)) {
            fail(`${where} ha de ser un objecte.`);
            return;
        }

        if (typeof artist.name !== 'string' || !artist.name.trim()) {
            fail(`${where}.name és obligatori.`);
        } else {
            const normalized = artist.name.trim().toLocaleLowerCase('ca');
            if (names.has(normalized)) fail(`Artista duplicat: ${artist.name}`);
            names.add(normalized);
        }

        ['aliases', 'genres', 'territories', 'languages', 'sources'].forEach((field) => {
            if (!isStringArray(artist[field])) fail(`${where}.${field} ha de ser un array de textos.`);
        });

        if (artist.genresRaw !== undefined && !isStringArray(artist.genresRaw)) {
            fail(`${where}.genresRaw ha de ser un array de textos si existeix.`);
        }

        for (const genre of artist.genres || []) {
            if (!GENRES.has(genre)) fail(`${where}.genres conté una categoria no oficial: ${genre}`);
        }

        if (!(artist.wikidataId === null || (typeof artist.wikidataId === 'string' && WIKIDATA_RE.test(artist.wikidataId)))) {
            fail(`${where}.wikidataId no és vàlid.`);
        } else if (artist.wikidataId) {
            if (qids.has(artist.wikidataId)) fail(`Wikidata ID duplicat: ${artist.wikidataId}`);
            qids.add(artist.wikidataId);
        }

        if (!(artist.musicbrainzId === null || (typeof artist.musicbrainzId === 'string' && MUSICBRAINZ_RE.test(artist.musicbrainzId)))) {
            fail(`${where}.musicbrainzId no és vàlid.`);
        }

        if (!CONFIDENCE.has(artist.confidence)) fail(`${where}.confidence no és vàlid.`);
        if (!REVIEW.has(artist.reviewStatus)) fail(`${where}.reviewStatus no és vàlid.`);
        if (typeof artist.active !== 'boolean') fail(`${where}.active ha de ser booleà.`);
        if (artist.reviewStatus === 'aprovat' && !artist.active) fail(`${where}: un artista aprovat ha d'estar actiu.`);
        if (artist.reviewStatus === 'rebutjat' && artist.active) fail(`${where}: un artista rebutjat no pot estar actiu.`);
        if (!(artist.lastChecked === null || typeof artist.lastChecked === 'string')) fail(`${where}.lastChecked ha de ser null o una data ISO.`);
        if (typeof artist.notes !== 'string') fail(`${where}.notes ha de ser text.`);

        const channels = artist.youtube?.channels;
        const candidates = artist.youtube?.candidates;
        if (candidates !== undefined && !Array.isArray(candidates)) {
            fail(`${where}.youtube.candidates ha de ser un array si existeix.`);
        }
        if (Array.isArray(candidates)) {
            const candidateUrls = new Set();
            candidates.forEach((candidate, candidateIndex) => {
                const candidateWhere = `${where}.youtube.candidates[${candidateIndex}]`;
                if (!candidate || typeof candidate.url !== 'string' || !candidate.url.startsWith('http')) {
                    fail(`${candidateWhere}.url no és vàlid.`);
                }
                if (candidateUrls.has(candidate.url)) fail(`${candidateWhere}.url està duplicat.`);
                candidateUrls.add(candidate.url);
                if (!(candidate.handle === null || typeof candidate.handle === 'string')) fail(`${candidateWhere}.handle no és vàlid.`);
                if (!['youtube', 'youtube-music', 'video-channel'].includes(candidate.relationType)) fail(`${candidateWhere}.relationType no és vàlid.`);
                if (candidate.source !== 'musicbrainz') fail(`${candidateWhere}.source ha de ser musicbrainz.`);
                if (typeof candidate.discoveredAt !== 'string') fail(`${candidateWhere}.discoveredAt és obligatori.`);
            });
        }

        const searchCandidates = artist.youtube?.searchCandidates;
        if (searchCandidates !== undefined && !Array.isArray(searchCandidates)) {
            fail(`${where}.youtube.searchCandidates ha de ser un array si existeix.`);
        }
        if (Array.isArray(searchCandidates)) {
            const searchIds = new Set();
            searchCandidates.forEach((candidate, candidateIndex) => {
                const candidateWhere = `${where}.youtube.searchCandidates[${candidateIndex}]`;
                if (!CHANNEL_ID_RE.test(candidate?.id || '')) fail(`${candidateWhere}.id no és vàlid.`);
                if (searchIds.has(candidate.id)) fail(`${candidateWhere}.id està duplicat.`);
                searchIds.add(candidate.id);
                if (typeof candidate.title !== 'string') fail(`${candidateWhere}.title no és vàlid.`);
                if (!(candidate.handle === null || typeof candidate.handle === 'string')) fail(`${candidateWhere}.handle no és vàlid.`);
                if (!Number.isInteger(candidate.subscriberCount) || candidate.subscriberCount < 0) fail(`${candidateWhere}.subscriberCount no és vàlid.`);
                if (!Number.isInteger(candidate.score) || candidate.score < 0) fail(`${candidateWhere}.score no és vàlid.`);
                if (!Array.isArray(candidate.reasons)) fail(`${candidateWhere}.reasons ha de ser un array.`);
                if (!['official', 'topic'].includes(candidate.suggestedType)) fail(`${candidateWhere}.suggestedType no és vàlid.`);
            });
        }

        const ys = artist.enrichment?.youtubeSearch;
        if (ys !== undefined) {
            if (!ys || typeof ys !== 'object') fail(`${where}.enrichment.youtubeSearch no és vàlid.`);
            if (typeof ys.checkedAt !== 'string') fail(`${where}.enrichment.youtubeSearch.checkedAt és obligatori.`);
            if (!['autoacceptat', 'candidats', 'sense-resultats', 'error'].includes(ys.status)) fail(`${where}.enrichment.youtubeSearch.status no és vàlid.`);
            if (typeof ys.query !== 'string') fail(`${where}.enrichment.youtubeSearch.query no és vàlid.`);
            if (!Number.isInteger(ys.resultCount) || ys.resultCount < 0) fail(`${where}.enrichment.youtubeSearch.resultCount no és vàlid.`);
        }

        const genreState = artist.enrichment?.genres;
        if (genreState !== undefined) {
            if (!genreState || typeof genreState !== 'object') fail(`${where}.enrichment.genres no és vàlid.`);
            if (!(genreState.checkedAt === null || typeof genreState.checkedAt === 'string')) fail(`${where}.enrichment.genres.checkedAt no és vàlid.`);
            if (!(genreState.musicbrainzCheckedAt === null || typeof genreState.musicbrainzCheckedAt === 'string')) fail(`${where}.enrichment.genres.musicbrainzCheckedAt no és vàlid.`);
            if (!(genreState.musicbrainzTagsCheckedAt === undefined || genreState.musicbrainzTagsCheckedAt === null || typeof genreState.musicbrainzTagsCheckedAt === 'string')) fail(`${where}.enrichment.genres.musicbrainzTagsCheckedAt no és vàlid.`);
            if (!(genreState.musicbrainzReleaseCheckedAt === undefined || genreState.musicbrainzReleaseCheckedAt === null || typeof genreState.musicbrainzReleaseCheckedAt === 'string')) fail(`${where}.enrichment.genres.musicbrainzReleaseCheckedAt no és vàlid.`);
            if (genreState.musicbrainzReleaseRaw !== undefined && !isStringArray(genreState.musicbrainzReleaseRaw)) {
                fail(`${where}.enrichment.genres.musicbrainzReleaseRaw ha de ser un array de textos si existeix.`);
            }
            if (genreState.musicbrainzReleaseEvidence !== undefined) {
                if (!Array.isArray(genreState.musicbrainzReleaseEvidence)) fail(`${where}.enrichment.genres.musicbrainzReleaseEvidence ha de ser un array.`);
                else genreState.musicbrainzReleaseEvidence.forEach((evidence, evidenceIndex) => {
                    if (!evidence || typeof evidence.label !== 'string' || !Number.isInteger(evidence.releaseGroupCount) || evidence.releaseGroupCount < 2) {
                        fail(`${where}.enrichment.genres.musicbrainzReleaseEvidence[${evidenceIndex}] no és vàlid.`);
                    }
                });
            }
            if (!(genreState.wikidataWorkCheckedAt === undefined || genreState.wikidataWorkCheckedAt === null || typeof genreState.wikidataWorkCheckedAt === 'string')) fail(`${where}.enrichment.genres.wikidataWorkCheckedAt no és vàlid.`);
            if (genreState.wikidataWorkEvidence !== undefined) {
                if (!Array.isArray(genreState.wikidataWorkEvidence)) fail(`${where}.enrichment.genres.wikidataWorkEvidence ha de ser un array.`);
                else genreState.wikidataWorkEvidence.forEach((evidence, evidenceIndex) => {
                    if (!evidence || typeof evidence.genre !== 'string' || !Number.isInteger(evidence.workCount) || evidence.workCount < 1) {
                        fail(`${where}.enrichment.genres.wikidataWorkEvidence[${evidenceIndex}] no és vàlid.`);
                    }
                });
            }
            ['wikidataRaw', 'wikidataWorkRaw', 'musicbrainzRaw', 'unmappedRaw'].forEach((field) => {
                if (!isStringArray(genreState[field])) fail(`${where}.enrichment.genres.${field} ha de ser un array de textos.`);
            });
            if (genreState.musicbrainzTagsRaw !== undefined && !isStringArray(genreState.musicbrainzTagsRaw)) {
                fail(`${where}.enrichment.genres.musicbrainzTagsRaw ha de ser un array de textos si existeix.`);
            }
            if (!['pendent', 'classificat', 'parcial', 'per-revisar', 'sense-dades'].includes(genreState.status)) {
                fail(`${where}.enrichment.genres.status no és vàlid.`);
            }
        }

        const mb = artist.enrichment?.musicbrainz;
        if (mb !== undefined) {
            if (!mb || typeof mb !== 'object') fail(`${where}.enrichment.musicbrainz no és vàlid.`);
            if (!(mb.checkedAt === null || typeof mb.checkedAt === 'string')) fail(`${where}.enrichment.musicbrainz.checkedAt no és vàlid.`);
            if (!['pendent', 'trobat', 'sense-youtube', 'error'].includes(mb.status)) fail(`${where}.enrichment.musicbrainz.status no és vàlid.`);
        }

        if (!Array.isArray(channels)) {
            fail(`${where}.youtube.channels ha de ser un array.`);
            return;
        }

        let primaryCount = 0;
        const channelIds = new Set();
        channels.forEach((channel, channelIndex) => {
            const channelWhere = `${where}.youtube.channels[${channelIndex}]`;
            if (!CHANNEL_ID_RE.test(channel.id || '')) fail(`${channelWhere}.id no és un YouTube channel ID vàlid.`);
            if (channelIds.has(channel.id)) fail(`${channelWhere}.id està duplicat dins de l'artista.`);
            channelIds.add(channel.id);
            if (!(channel.handle === null || (typeof channel.handle === 'string' && channel.handle.startsWith('@')))) {
                fail(`${channelWhere}.handle ha de ser null o començar per @.`);
            }
            if (!(channel.name === null || typeof channel.name === 'string')) fail(`${channelWhere}.name ha de ser null o text.`);
            if (!CHANNEL_TYPES.has(channel.type)) fail(`${channelWhere}.type no és vàlid.`);
            if (typeof channel.primary !== 'boolean') fail(`${channelWhere}.primary ha de ser booleà.`);
            if (channel.primary) primaryCount += 1;
        });

        if (primaryCount > 1) fail(`${where} té més d'un canal principal.`);
    });
}

if (!process.exitCode) {
    console.log(`✅ Base d'artistes vàlida: ${data.artists.length} artistes.`);
}
