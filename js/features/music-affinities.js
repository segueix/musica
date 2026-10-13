// Perfils editorials documentats: no són mesures d'àudio ni etiquetes de totes les cançons.
// Font única de dades del pilot; nous estils requereixen revisió i activació explícita.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;
    const CATEGORY = 'Ska / Reggae';
    const profiles = [
        {
            artist: 'Aspencat',
            channelIds: ['UCcyD1Q9V5wfaGD1Z5CH1Nlw', 'UCnygquYeJppJcbgD085undw'],
            facets: ['reggae', 'rock', 'rap', 'dancehall', 'electronic'],
            confidence: 0.8,
            sources: ['https://halleyrecords.com/artist/aspencat/'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Auxili',
            channelIds: ['UCflfVr855Oze52vJjp_gmfg', 'UCF61X-XZzSKlfnn3JIMIm9g'],
            facets: ['reggae', 'ska'],
            confidence: 1,
            sources: ['https://www.propaganda-pel-fet.cat/index.php/cat/artistes/auxili'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Boom Boom Fighters',
            channelIds: ['UCMIJ1Y_N61x72rTIAeyzRKA'],
            facets: ['reggae', 'dancehall'],
            confidence: 1,
            sources: ['https://www.sala-apolo.com/cat/event/curtciruit-boom-boom-fighters-cookah-p-5080'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Brams',
            channelIds: ['UCuk-lO3FpbukFk5lcPx29_g'],
            facets: ['rock'],
            confidence: 0.7,
            sources: ['https://www.youtube.com/channel/UCuk-lO3FpbukFk5lcPx29_g'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Dr. Calypso',
            channelIds: ['UCX95O_Gs_2ob3p86_MgldhA'],
            facets: ['ska', 'reggae', 'rocksteady', 'soul'],
            confidence: 0.8,
            sources: ['https://ca.wikipedia.org/wiki/Dr._Calypso'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: "Guaita'ls",
            channelIds: ['UChp3Qj6gtmg9chsHHDFyVyg', 'UCqCzt7Atzt9MRZ1PNnQreMA'],
            facets: ['ska', 'reggae'],
            confidence: 0.6,
            sources: ['https://es-academic.com/dic.nsf/eswiki/1300668/'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Kayo Malayo',
            channelIds: ['UCkJn1Oupgp27jlFzFl7I2Ag'],
            facets: ['ska', 'reggae', 'cumbia', 'pop', 'rock'],
            confidence: 0.7,
            sources: ['https://ca.wikipedia.org/wiki/Kayo_Malayo'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'La Pegatina',
            channelIds: ['UCr8kBnuIa6LPmhZSxbwVs7w', 'UCMepRsHQTgYZd3u__Xbj_6A'],
            facets: ['ska', 'rumba', 'merengue'],
            confidence: 1,
            sources: ['https://lapegatina.com/biografia/'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Les Testarudes',
            channelIds: ['UCICi6PgGxMiqrzwepxP0VZA', 'UCHbefcM_E94xfrGz6CWC9vQ'],
            facets: ['ska', 'reggae', 'rocksteady'],
            confidence: 1,
            sources: ['https://www.fim.cat/es/artistas/les-testarudes/'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Mr. Freak Ska',
            channelIds: ['UCElR_cmETBNoC7Rs6STl0BA'],
            facets: ['ska', 'reggae', 'rocksteady'],
            confidence: 1,
            sources: ['https://mrfreakska.bandcamp.com/album/ska-de-vells'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Obrint Pas',
            channelIds: ['UCBHDy6i_tQcWOjczk47PQyA', 'UCPMX7e8_PQtgqcDHzzbfX7g'],
            facets: ['ska', 'reggae', 'hardcore', 'traditional'],
            confidence: 1,
            sources: ['https://ppf.cat/index.php/es/artistas/obrint-pas'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Pepet i Marieta',
            channelIds: ['UCPzFXRl5ozCmX7i4CjI3Odw', 'UCT59tXHgcrnLCerfyEGDghw'],
            facets: ['reggae', 'ska', 'pop', 'rock', 'traditional'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCPzFXRl5ozCmX7i4CjI3Odw'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Skatalà',
            channelIds: ['UCUWHtSvVKAhJn-zsf38q2TQ'],
            facets: ['ska', 'punk'],
            confidence: 1,
            sources: ['https://skatala.bandcamp.com/album/un-de-nou'],
            reviewedAt: '2026-10-13',
        },
        {
            artist: 'Txarango',
            channelIds: ['UCmtykAu3QbU-yVO6Jirm1_Q', 'UCIDxAwPe8cNl_-NawMu4pDQ'],
            facets: ['ska', 'reggae', 'rumba'],
            confidence: 0.8,
            sources: [
                'https://diumenge.ara.cat/premium/suplements/ara_tu/detenir-carrer-seguent-actuavem-merce_1_3859635.html',
            ],
            reviewedAt: '2026-10-13',
        },
    ];
    const byChannel = new Map();
    profiles.forEach(profile => profile.channelIds.forEach(id => byChannel.set(id, profile)));
    // Les excepcions futures han de portar facets, confidence, sources i reviewedAt.
    // Clau exacta de vídeo: mai no es dedueixen excepcions pel nom de l'artista.
    const trackOverrides = Object.create(null);

    function profileOf(video) {
        if (!video) return null;
        const override = trackOverrides[video.id];
        if (override) return override;
        // Un arranjament diferent necessita revisió pròpia abans d'heretar el perfil.
        if (
            video.contentType === 'live_song' ||
            /\b(live|directe|ac[uú]stic[oa]?|unplugged|remix)\b/i.test(video.title || '')
        ) {
            return null;
        }
        return byChannel.get(video.channelId || video.snippet?.channelId) || null;
    }

    function similarity(a, b) {
        const left = profileOf(a);
        const right = profileOf(b);
        if (!left || !right) return 0.5;
        const union = new Set([...left.facets, ...right.facets]);
        const common = left.facets.filter(facet => right.facets.includes(facet)).length;
        const confidence = Math.min(left.confidence, right.confidence);
        return 0.5 + ((union.size ? common / union.size : 0.5) - 0.5) * confidence;
    }

    function isActive(category, policy = 'general', mix = null) {
        const categories = Array.isArray(category) ? category : [category];
        return policy === 'general' && !mix && categories.length === 1 && categories[0] === CATEGORY;
    }

    // Ajust màxim ±0,06, només entre candidates que ja compleixen les restriccions.
    // La cançó inicial manté el rumb; la darrera cançó guia la transició local.
    function transition(candidate, previous, seed) {
        return 0.12 * (0.8 * (similarity(candidate, previous) - 0.5) + 0.2 * (similarity(candidate, seed) - 0.5));
    }

    app.features = app.features || {};
    app.features.musicAffinities = {
        category: CATEGORY,
        profiles,
        profileOf,
        similarity,
        isActive,
        transition,
    };
})(window);
