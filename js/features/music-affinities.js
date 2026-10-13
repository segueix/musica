// Perfils editorials documentats: no són mesures d'àudio ni etiquetes de totes les cançons.
// Font única de dades del pilot; nous estils requereixen revisió i activació explícita.
(function (window) {
    const app = window.SegueixApp;
    if (!app) return;
    const CATEGORY = 'Ska / Reggae';
    const skaProfiles = [
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
    const heavyProfiles = [
        {
            artist: 'Amargor',
            channelIds: ['UCoOJY5SD3f0RvSk6uhRVZ_A'],
            facets: ['black-metal', 'raw-black-metal'],
            confidence: 1,
            sources: ['https://paral-lel62.cat/en/programacio/catalunya-triomfant-2026-parallel62-eng/'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Angoixa',
            channelIds: ['UC7CW0LUdtTnZfYmuayRJEmQ', 'UCOwCZBGNBYlvxmZn2BbmhFQ'],
            facets: ['death-metal'],
            confidence: 1,
            sources: ['https://www.youtube.com/channel/UCOwCZBGNBYlvxmZn2BbmhFQ'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Assot',
            channelIds: ['UCgAPpOaGsoDsXdEQKLB6gnQ'],
            facets: ['death-metal', 'sludge'],
            confidence: 0.9,
            sources: ['https://assot.bandcamp.com/album/bullen-les-calderes'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Astral Warrior',
            channelIds: ['UC7auRFIxjfkrZdsWPe7R_Qg', 'UCh_dOmbZ0ZkjBEYDH96NNqQ'],
            facets: ['heavy-metal', 'power-metal'],
            confidence: 1,
            sources: ['https://astralwarriors.bandcamp.com/album/metalunya'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Avalot',
            channelIds: ['UCcG2ayuF3B2xDZIVH2LNefg'],
            facets: ['heavy-metal'],
            confidence: 0.7,
            sources: ['https://www.enderrock.cat/disc/2180/somnis'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Bestiari',
            channelIds: ['UCf0MYgzgqhRYuimo71a2dYQ'],
            facets: ['hardcore'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCf0MYgzgqhRYuimo71a2dYQ'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Bocc',
            channelIds: ['UCR5qRB1oeWWJF8QhX7WmuXQ'],
            facets: ['death-metal', 'doom-metal'],
            confidence: 1,
            sources: ['https://bocc.bandcamp.com/music'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Entropia',
            channelIds: ['UCayj6r8npsfkvYupNj8YC4A', 'UCT-wRacXWBQKqr1z6ZGoubw'],
            facets: ['doom-metal', 'drone'],
            confidence: 1,
            sources: ['https://www.youtube.com/channel/UCT-wRacXWBQKqr1z6ZGoubw'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Falç de Fetillera',
            channelIds: ['UCgVBViL3I9YWFVBHIyvcpjg', 'UC8GlOjZpZMKHieUbeJ9eh7g'],
            facets: ['doom-metal', 'folk'],
            confidence: 1,
            sources: ['https://www.youtube.com/channel/UCgVBViL3I9YWFVBHIyvcpjg'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Forja',
            channelIds: ['UCBaZT9T1jD6ggbVikvr0nAw', 'UCmciKowevXGORJnZGaZVrsg'],
            facets: ['folk', 'symphonic-metal', 'power-metal', 'death-metal'],
            confidence: 0.8,
            sources: ['https://www.forja-metal.com/', 'https://forja.bandcamp.com/album/tornant-de-la-batalla'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Foscor',
            channelIds: ['UCpWzqKujkmJvGIAt5QgBgBQ'],
            facets: ['black-metal', 'post-metal', 'progressive-metal'],
            confidence: 0.7,
            sources: ['https://www.season-of-mist.com/bands/foscor/'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Icestorm',
            channelIds: ['UCcjUSZZ1Aqt74OqoXtkb51A'],
            facets: ['death-metal', 'melodic-death-metal'],
            confidence: 0.9,
            sources: ['https://icestorm.bandcamp.com/'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'KOP',
            channelIds: ['UCvSMpTrqlrZxYbhZoTbsQoA', 'UCC66jsgEM01kvhvwJ59xttA'],
            facets: ['hardcore', 'punk', 'crossover'],
            confidence: 1,
            sources: ['https://www.oa2produccions.cat/kop-2/'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Korruption Found',
            channelIds: ['UCCNmteQmEPFZTuM8joXB2Vw', 'UClGOkwEfKOBUuvepYGT9AUQ'],
            facets: ['death-metal', 'black-metal'],
            confidence: 1,
            sources: ['https://www.youtube.com/channel/UClGOkwEfKOBUuvepYGT9AUQ'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Moksha',
            channelIds: ['UC3uMAvZMHLOMo3OSDjqAVYQ'],
            facets: ['grindcore', 'hardcore'],
            confidence: 0.9,
            sources: ['https://bcmoksha.bandcamp.com/track/cavalgant-la-corda-fluixa'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Ósserp',
            channelIds: ['UCCmgW83QdTLEGTkEc6uyJ6Q'],
            facets: ['death-metal', 'black-metal', 'grindcore'],
            confidence: 1,
            sources: ['https://osserp.bandcamp.com/album/els-nous-cants-de-la-sibil-la'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Pesta Porcina',
            channelIds: ['UCeZTzF8dhFsh_BcqHUzygjg'],
            facets: ['goregrind', 'grindcore'],
            confidence: 0.8,
            sources: ['https://www.metal-archives.com/bands/Pesta_Porcina/23250'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Sangtraït',
            channelIds: ['UC6a_paoSt1YYKOFZwPGdEYw'],
            facets: ['heavy-metal', 'hard-rock'],
            confidence: 0.8,
            sources: ['https://en.wikipedia.org/wiki/Sangtra%C3%AFt'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Tempestat',
            channelIds: ['UCxVQcJujZLvClGNyvobPRyQ', 'UC50KRxJXBWgOj3Q05CDAs8w'],
            facets: ['black-metal', 'grindcore', 'crust'],
            confidence: 1,
            sources: ['https://www.youtube.com/channel/UCxVQcJujZLvClGNyvobPRyQ'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Thanatopraxy',
            channelIds: ['UCZ9JPgA_kLvdtOpbIzs8Yew'],
            facets: ['goregrind', 'grindcore'],
            confidence: 0.8,
            sources: ['https://www.metal-archives.com/bands/Thanatopraxy/3540484882'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Udol',
            channelIds: ['UCrxpjvY7G2ffEklcmSHm5og', 'UCQz3jf86vHTtfVwXd-rOSrA', 'UCYnT07O7RJlNvU_sNq6EsZQ'],
            facets: ['doom-metal'],
            confidence: 1,
            sources: ['https://udol.bandcamp.com/music'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Vidres a la Sang',
            channelIds: ['UCWWnWo4E1RqWDOX4-y1jwfQ', 'UCZKSBZ8hKicoNtWdq1hzTfw'],
            facets: ['black-metal', 'death-metal', 'heavy-metal', 'progressive-metal'],
            confidence: 0.9,
            sources: ['https://vidresalasang.bandcamp.com/album/virtut-del-desenc-s'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
        {
            artist: 'Vrademargk',
            channelIds: ['UC5b2TCGWRI0ulWbpeCm9dnw', 'UC0Ury5l6zFGf9ws25up1ucg'],
            facets: ['death-metal', 'melodic-death-metal'],
            confidence: 0.8,
            sources: ['https://vrademargk.bandcamp.com/album/the-black-chamber'],
            reviewedAt: '2026-10-13',
            categories: ['Heavy / Metal'],
        },
    ];
    const profiles = [...skaProfiles.map(profile => ({ ...profile, categories: [CATEGORY] })), ...heavyProfiles];
    const enabledCategories = [CATEGORY, 'Heavy / Metal'];
    const profilesFor = category => profiles.filter(profile => profile.categories.includes(category));
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
            /\b(live|direct[eo]|en viu|en vivo|acoustic|ac[uú]stic[oa]?|unplugged|remix)\b/i.test(video.title || '')
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
        return policy === 'general' && !mix && categories.length === 1 && enabledCategories.includes(categories[0]);
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
        profilesFor,
        enabledCategories,
        profileOf,
        similarity,
        isActive,
        transition,
    };
})(window);
