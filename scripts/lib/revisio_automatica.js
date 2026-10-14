'use strict';

// Motor sense I/O. Una proposta NO és una validació ni modifica el catàleg.
const { createHash } = require('node:crypto');
const VERSION = '1';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = value => /^[\w-]{11}$/.test(String(value || ''));
const normalize = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
const unique = values => [...new Set(values)];
const LANGUAGES = ['ca', 'es', 'en', 'fr', 'it', 'oc', 'other', 'und'];

function fingerprint(entry, policyHash, capabilities) {
    // No incloure updatedAt: canvia a cada generació encara que la peça sigui la mateixa.
    return hash([VERSION, entry.id, entry.artistaId, entry.artista, entry.canalId, entry.titol,
        entry.tipus, entry.descripcio, policyHash, capabilities]);
}

function selectBatch(entries, cache, { limit = 100, now, policyHash = '', capabilities = '' }) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Límit: enter entre 1 i 100.');
    const buckets = new Map();
    const seen = new Set();
    for (const entry of entries) {
        if (!validId(entry.id) || seen.has(entry.id)) continue;
        seen.add(entry.id);
        const policy = typeof policyHash === 'function' ? policyHash(entry) : policyHash;
        const fp = fingerprint(entry, policy, capabilities);
        const old = cache.items?.[entry.id];
        if (old?.fingerprint === fp && (old.attempts >= 3 || Date.parse(old.retryAt) > Date.parse(now))) continue;
        // Alterna artistes i tipus; no consumeix tot el lot amb el primer artista de l'alfabet.
        const key = `${entry.artistaId || entry.canalId || entry.artista}::${entry.tipus || 'song'}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ ...entry, fingerprint: fp });
    }
    for (const bucket of buckets.values()) bucket.sort((a, b) => {
        const aa = cache.items?.[a.id]?.checkedAt || '';
        const bb = cache.items?.[b.id]?.checkedAt || '';
        return aa.localeCompare(bb) || a.id.localeCompare(b.id);
    });
    const selected = [];
    while (selected.length < limit) {
        let added = false;
        for (const bucket of buckets.values()) {
            if (bucket.length && selected.length < limit) { selected.push(bucket.shift()); added = true; }
        }
        if (!added) break;
    }
    return selected;
}

function documentaryRecords(entry, state, registry) {
    const exact = (state.decisions || []).filter(d => d.id === entry.id && /^https:\/\//.test(d.font || '')
        && ['conserva', 'amaga'].includes(d.accio) && d.criteri !== 'confianca-artista');
    const discs = (registry.discsVerificats || []).filter(d => d.artista === entry.artista
        && d.videoIds?.includes(entry.id) && /^https:\/\//.test(d.font || '')
        && ['conserva', 'amaga'].includes(d.accio));
    return { exact, discs };
}

function evidenceFingerprint(entry, state, registry) {
    const { exact, discs } = documentaryRecords(entry, state, registry);
    // Una decisió sobre un altre vídeo o disc no reinicia el progrés d’aquest.
    const values = [
        ...exact.map(d => ['video', d.accio, d.font, d.criteri || '']),
        ...discs.map(d => ['disc', d.accio, d.font]),
    ].map(value => JSON.stringify(value)).sort();
    return hash(unique(values));
}

function capabilityFingerprint({ ai, youtube, model, webSearch }) {
    // Mida de lot, pressupostos i mode d’execució no canvien les proves d’una peça.
    return hash({ ai: Boolean(ai), youtube: Boolean(youtube),
        model: ai ? model : null, webSearch: Boolean(ai && webSearch) });
}

function documentaryEvidence(entry, state, registry) {
    const { exact, discs } = documentaryRecords(entry, state, registry);
    const evidence = [...exact, ...discs];
    if (!evidence.length) return null;
    if (unique(evidence.map(d => d.accio)).length !== 1) return { status: 'pendent', reason: 'fonts-en-conflicte' };
    return { status: evidence[0].accio === 'amaga' ? 'proposta-amagar' : 'proposta-conservar',
        reason: exact.length ? 'decisio-documentada-del-mateix-video' : 'edicio-documentada-amb-id-explicit',
        method: 'documental', sources: unique(evidence.map(d => d.font)), fullLyricsVerified: false };
}

function descriptionSource(entry, video) {
    if (!video || video.id !== entry.id || video.channelId !== entry.canalId) return null;
    const text = String(video.description || '');
    if (!text.trim() || text.length > 14000) return null; // Mai truncar una lletra i donar-la per completa.
    return { id: entry.id, url: `https://www.youtube.com/watch?v=${entry.id}`, text,
        lines: text.replace(/\r\n?/g, '\n').split('\n'), sha256: hash(text) };
}

function lyricCandidate(source) {
    return Boolean(source && source.text.length >= 120 && source.lines.filter(l => l.trim()).length >= 6
        && /(?:^|\n)\s*(?:lletra\s*:|lyrics\s*:|letra\s*:|\[?(?:tornada|estrofa|chorus|verse)\b)/im.test(source.text)
        && !/^provided to youtube\b/i.test(source.text));
}

function checkAnalysis(source, analysis) {
    const pending = reason => ({ status: 'pendent', reason });
    if (!source || !analysis || analysis.videoId !== source.id) return pending('identitat-no-confirmada');
    if (!analysis.sameVersion || !analysis.completeLyrics || analysis.conflict || analysis.instrumental) {
        return pending(analysis.instrumental ? 'instrumental-no-demostrat' : 'lletra-o-versio-no-confirmada');
    }
    const { startLine, endLine } = analysis;
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1
        || endLine < startLine || endLine > source.lines.length) return pending('interval-invalid');
    const lyricLines = source.lines.slice(startLine - 1, endLine);
    if (lyricLines.filter(l => l.trim()).length < 4 || normalize(lyricLines.join(' ')).length < 120) {
        return pending('text-insuficient');
    }
    if (!Array.isArray(analysis.segments) || !analysis.segments.length) return pending('sense-proves-textuals');
    const covered = new Set();
    const languages = [];
    const ranges = [];
    for (const segment of analysis.segments) {
        const { start, end, language, quote } = segment;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < startLine || end > endLine || end < start
            || !LANGUAGES.includes(language) || normalize(quote).length < 4 || String(quote).length > 100) {
            return pending('segment-invalid');
        }
        const original = normalize(source.lines.slice(start - 1, end).join(' '));
        if (!original.includes(normalize(quote))) return pending('citacio-no-existent');
        for (let line = start; line <= end; line++) {
            if (covered.has(line)) return pending('segments-solapats');
            covered.add(line);
        }
        languages.push(language);
        ranges.push({ start, end, language }); // No publicar fragments de lletres.
    }
    for (let line = startLine; line <= endLine; line++) {
        if (source.lines[line - 1].trim() && !covered.has(line)) return pending('lletra-no-coberta');
    }
    if (languages.includes('und')) return pending('llengua-ambigua');
    return { status: languages.every(l => l === 'ca') ? 'proposta-conservar' : 'proposta-amagar',
        reason: languages.every(l => l === 'ca') ? 'text-catala-proposat-per-ia' : 'text-no-exclusivament-catala-proposat-per-ia',
        method: 'ia-amb-citacions-contrastades', languages: unique(languages), sources: [source.url],
        sourceHash: source.sha256, ranges, fullLyricsVerified: false, requiresHumanApproval: true };
}

function checkpoint(cache, entry, result, now) {
    const old = cache.items?.[entry.id];
    const attempts = old?.fingerprint === entry.fingerprint ? (old.attempts || 0) + 1 : 1;
    // Les mancances de configuració i els límits no esgoten els intents editorials.
    const transient = /^(sense-clau|pressupost|error-api)/.test(result.reason || '');
    const days = transient ? 1 : result.status === 'pendent' ? 7 : 30;
    return { fingerprint: entry.fingerprint, checkedAt: now,
        retryAt: new Date(Date.parse(now) + days * 86400000).toISOString(),
        attempts: transient ? Math.max(0, attempts - 1) : attempts, result };
}

function summary(results) {
    return { examined: results.length, proposeKeep: results.filter(r => r.status === 'proposta-conservar').length,
        proposeHide: results.filter(r => r.status === 'proposta-amagar').length,
        unresolved: results.filter(r => r.status === 'pendent').length, applied: 0 };
}

module.exports = { VERSION, hash, validId, normalize, fingerprint, selectBatch,
    evidenceFingerprint, capabilityFingerprint, documentaryEvidence, descriptionSource, lyricCandidate, checkAnalysis, checkpoint, summary };
