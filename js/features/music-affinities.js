// Perfils editorials documentats: no són mesures d'àudio ni etiquetes de totes les cançons.
// Els perfils detallats completen el catàleg generat i les relacions documentades.
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
            categories: ['Heavy / Metal', 'Punk'],
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
    const punkProfiles = [
        {
            artist: 'All Crü',
            channelIds: ['UCyNWjZ1IhLo8Iy6nUMEz0rw', 'UC_tsO4hz22Lk0jb1CEIFPmw'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCyNWjZ1IhLo8Iy6nUMEz0rw'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Apologia',
            channelIds: ['UCkIaaBrbzpnm0jbPXxNGwPw'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCkIaaBrbzpnm0jbPXxNGwPw'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'ASSAC!',
            channelIds: ['UCzyjfdkAmiRCOjJGuUVbqYg'],
            facets: ['hardcore'],
            confidence: 0.8,
            sources: ['https://assac.bandcamp.com/community'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
            allowedVideoIdsByChannel: {
                UCzyjfdkAmiRCOjJGuUVbqYg: ['8S-V2kDuDlY', 'AJ6ab1pyaMI', 'JdXvQ6B_ge8'],
            },
        },
        {
            artist: 'Autodestrucció',
            channelIds: ['UC8yBjieIRVNRxjAVi0FO1DQ'],
            facets: ['punk-rock', 'hardcore', 'melodic-hardcore'],
            confidence: 0.8,
            sources: ['https://saltamarges.bandcamp.com/album/neva-a-tot-arreu'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Bacora',
            channelIds: ['UCHf4JVtqfIL_emZFYmchjkw'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://bacora.bandcamp.com/album/antifans'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Baixa Fidelitat',
            channelIds: ['UCk0dxKPgahJyFPV_F1VWVuA'],
            facets: ['punk-rock', 'pop-punk'],
            confidence: 0.8,
            sources: ['https://baixafidelitat.bandcamp.com/album/baixa-fidelitat'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Batec',
            channelIds: ['UCmgvpf_Hz64idSYh4hFGHkQ'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://batec.bandcamp.com/album/ara-i-sempre'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Bonestorm',
            channelIds: ['UCJXKRxaUXEg0kpgb-Kd8uDg', 'UCGPjtE1NFB1I8oDJ_Mx3O_Q'],
            facets: ['hardcore'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCJXKRxaUXEg0kpgb-Kd8uDg'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Brigada Moreneta',
            channelIds: ['UCcqVDo23bg_lYmIan70ZhhA', 'UCDxlvPSUVbtUrLsKDpGV_lw'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://lafurapenedes.cat/presentats-actes-barraca-festa-major-vilafranca/'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Brot Bord',
            channelIds: ['UCc2hL_Q_Fi_nKHLptRFnw3w', 'UCghKNKEskCkE55Wl5A-ggiQ'],
            facets: ['hardcore', 'melodic-hardcore', 'punk-rock'],
            confidence: 0.8,
            sources: ['https://brotbord.bandcamp.com/album/brot-bord'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Budellam',
            channelIds: ['UCxaFjfjCeRo1dUZXm_YtM6w'],
            facets: ['hardcore'],
            confidence: 0.8,
            sources: [
                'https://www.lafactoriadelritmo.com/spanish-hardcore-report/punetazos-de-ritmo-directos-al-estomago/',
            ],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
            allowedVideoIdsByChannel: {
                UCxaFjfjCeRo1dUZXm_YtM6w: [
                    'oMt8H43ENBY',
                    'h32bnGdpvwg',
                    'mKb-qmoaKKM',
                    't4hXWaOSEzU',
                    'jx22ka3_fxE',
                    'R7wi00B68R4',
                    'NhS1gxigf7s',
                    'z8mIu-8c08E',
                    'Km93zErYmHw',
                    'mVKPcoDQOMA',
                    'TFzzA2S_ld0',
                    'czkEXi0ozF4',
                    'P8STgxNu9lw',
                    '4jVWSJfi4IU',
                    'RTPtwffPCS8',
                    '4vgbgoB6F78',
                ],
            },
        },
        {
            artist: 'Coça',
            channelIds: ['UCPRiU_lr3A-0m0GmF098EkA'],
            facets: [],
            confidence: 0,
            sources: ['https://cossapunk.bandcamp.com/album/vacances-a-baviera'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
            reviewNote: 'Subestil pendent de documentar; afinitat neutral.',
        },
        {
            artist: 'Crim',
            channelIds: ['UCJhcsyqAVHFHmghWFkmIx4w', 'UCZ7V4w0VrZPSM21CiYNuk7g'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCJhcsyqAVHFHmghWFkmIx4w'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Daltabaix',
            channelIds: ['UCMI_YX4hq_6gmj5KXiSMCEQ', 'UCke5e6w0YsmcfxvngW4An3A'],
            facets: ['folk-punk', 'folk', 'emo'],
            confidence: 0.8,
            sources: ['https://elsdaltabaix.bandcamp.com/album/per-no-cremar-ho-tot'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Desperta Ferro',
            channelIds: ['UCtad7HKeiW-TwPgX-ZIOGZw'],
            facets: ['oi'],
            confidence: 0.8,
            sources: ['https://www.areapirata.com/prodotto/desperta-ferro-segueu-arran/'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Ebri Knight',
            channelIds: ['UC3pZduX_rJBAuisKRJYKatw', 'UC1n7SLx5qYPP1HzKh-rvyng'],
            facets: ['folk-punk', 'folk', 'punk-rock'],
            confidence: 0.8,
            sources: ['https://ebriknight.bandcamp.com/track/bruixes'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'En Brut',
            channelIds: ['UCnJ4T56eu1dxFBWin7Z7C3A', 'UC86_pXaC6Kh_U-ouv4OZ_DQ'],
            facets: ['hardcore'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCnJ4T56eu1dxFBWin7Z7C3A'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Enemic Interior',
            channelIds: ['UCAEf3q8jStY3hXlEtfoI0nA'],
            facets: ['post-punk', 'oi', 'hardcore'],
            confidence: 0.8,
            sources: ['https://flexidiscos.bandcamp.com/album/enemic-interior'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Esperit de Vi',
            channelIds: ['UCSBN6Ppa03Wh9WCXE4skixg'],
            facets: ['punk-rock', 'pop-punk', 'hardcore'],
            confidence: 0.8,
            sources: ['https://esperitdevi.bandcamp.com/album/dissil-ncia'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Família Fracàs',
            channelIds: ['UC6RbhWqXkSqfJDawc7pyPxQ'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://familiafracas.bandcamp.com/music'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Fetus',
            channelIds: ['UCDbEp5W8Obkk2YmYtWB-F5A'],
            facets: ['folk-punk', 'folk', 'garage-punk', 'punk-rock'],
            confidence: 0.8,
            sources: ['https://surtdecasa.cat/emporda/musica/entrevista-fetus'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Fox System',
            channelIds: ['UClEkW6DS-3DfOcxGMouE_7A', 'UCwCcA6f2KDLJi58xX2se6DA'],
            facets: ['punk-rock', 'pop-punk', 'hardcore'],
            confidence: 0.8,
            sources: ['https://foxsystem.bandcamp.com/album/fox-system'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'FP',
            channelIds: ['UCdontCcTg9y1senwNiJFECg'],
            facets: ['punk-rock', 'hardcore', 'emo', 'pop-punk'],
            confidence: 0.8,
            sources: ['https://fptheband.bandcamp.com/album/ciment'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Frontpilsen',
            channelIds: ['UCOxRObgDa7GRNF7UaO7B83w'],
            facets: ['oi', 'street-punk'],
            confidence: 0.8,
            sources: ['https://no80s-gruposnacionales.blogspot.com/2008/07/frontpilsen.html'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Gatzara',
            channelIds: ['UCZn28rxOtata8FamPOLCDug', 'UCgV7p1tbKMGsNjvg8Zhm4YQ'],
            facets: ['punk-rock', 'street-punk', 'hardcore'],
            confidence: 0.8,
            sources: ['https://gatzara.bandcamp.com/album/single-digital-maig-2024'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Gra Fort',
            channelIds: ['UC5PqMEE9b8osizQXQSdVkNQ'],
            facets: ['punk-rock', 'traditional'],
            confidence: 0.8,
            sources: ['https://www.enderrock.cat/disc/579/sirga'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Groggy Rude',
            channelIds: ['UC8hpq3EHqyG09og9xy3qOFg', 'UCG1eXBwVPsRtMl1xw0PmIKA'],
            facets: ['punk-rock', 'oi'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCG1eXBwVPsRtMl1xw0PmIKA'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Inadaptats',
            channelIds: ['UCHU_RiP5nttdIcrT37Y7-uA', 'UCby9BHawLhftHyR37pEztHg'],
            facets: ['oi', 'hardcore'],
            confidence: 0.8,
            sources: ['https://www.wikidata.org/wiki/Q3753043'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: "L'Odi Social",
            channelIds: ['UCkS1qH6mVR8T0hqyHJs0jnA'],
            facets: ['hardcore'],
            confidence: 0.8,
            sources: ['https://lodisocial.bandcamp.com/album/que-pagui-pujol-esventats-extras-reissue'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Les Aranyes',
            channelIds: ['UCN8HPAk-E5ZtrkLrDf7cR7A', 'UC3v9pZ9RLUMaaBrr877QPmA'],
            facets: ['horror-punk'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCN8HPAk-E5ZtrkLrDf7cR7A'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Les Buch',
            channelIds: ['UCNy0mWkgdGm_-fqav1J59dQ'],
            facets: ['pop-punk', 'punk-rock'],
            confidence: 0.8,
            sources: ['https://www.kasbamusic.com/es/2024/05/ya-en-la-calle-catalunya-explota/'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Les Cruet',
            channelIds: ['UCQgZIJD-VO5fH80azRymksg'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://ca.wikipedia.org/wiki/Les_Cruet'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Les Salvatges',
            channelIds: ['UC5prxpApFpUCRDrjIyIJjEg'],
            facets: ['punk-rock', 'melodic-punk'],
            confidence: 0.8,
            sources: [
                'https://www.casadelamusica.cat/index.php/agenda/agenda-concerts?catid=129&id=4468%3A20261030-re-lessalvatges&view=article',
            ],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Lladruc',
            channelIds: ['UCvab9QKJ1NEdMJObwZkA39A'],
            facets: ['oi'],
            confidence: 0.8,
            sources: ['https://www.youtube.com/channel/UCvab9QKJ1NEdMJObwZkA39A'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Mandanga!',
            channelIds: ['UC03QvbTvYBOyxApwRdt4k_w'],
            facets: ['hardcore'],
            confidence: 0.8,
            sources: ['https://mandangabcn.bandcamp.com/album/de-la-guantera-al-finestral'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Mendra',
            channelIds: ['UCokFPjgxi7i2ONsHr8wHj6g', 'UCtTPgp6W1WefOGfV3maG7JA'],
            facets: ['post-hardcore', 'emo', 'screamo'],
            confidence: 0.8,
            sources: ['https://saltamarges.bandcamp.com/album/hostal-hostil'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
            allowedVideoIdsByChannel: {
                UCokFPjgxi7i2ONsHr8wHj6g: ['pnBszIag64U', '7Wzf3EZ0fG4', 'K8HKCJzhwoU', 't21g-bOCFy0', 'slQ8MzfTIuY'],
                UCtTPgp6W1WefOGfV3maG7JA: ['7zcy83j0GuI', 'InSd11YRwXE'],
            },
        },
        {
            artist: 'Milícians',
            channelIds: ['UCzv2Zdpkuk5RefgIRkXggCw'],
            facets: ['oi', 'street-punk'],
            confidence: 0.8,
            sources: ['https://www.milicians.com/biografia/'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Opció K-95',
            channelIds: ['UCCBTyMmUoeGrciYMzrwWiUw'],
            facets: ['oi'],
            confidence: 0.8,
            sources: ['https://www.wikidata.org/wiki/Q4895718'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Panellet',
            channelIds: ['UCDX2tkKsA-KRAxfE6p_kVuQ'],
            facets: ['pop-punk', 'punk-rock', 'surf-punk'],
            confidence: 0.8,
            sources: ['https://panellet.bandcamp.com/album/aloha'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Pilseners',
            channelIds: ['UCcCicDkn0YDxOeir49bCwPQ', 'UCfMqjIyA0G1cVGNlFXXoJhA'],
            facets: ['oi', 'street-punk'],
            confidence: 0.8,
            sources: ['https://www.wikidata.org/wiki/Q20104364'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Pixamandúrries',
            channelIds: ['UCXQsHe-XMB9xWUxtRLFAWQg'],
            facets: ['hardcore', 'traditional'],
            confidence: 0.8,
            sources: ['https://www.enderrock.cat/disc/8389/dels-rics-dels-pobres'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Ratpenat',
            channelIds: ['UC0Us9bY-uMslfHcmZSVirRw'],
            facets: ['punk-rock', 'hardcore'],
            confidence: 0.8,
            sources: ['https://www.kasbamusic.com/es/2025/03/ratpenat-presentan-su-cuarto-album-cami-a-linfern/'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Saïm',
            channelIds: ['UCiUT6UwoOJsthloLMK0pSig'],
            facets: ['punk-rock', 'post-hardcore', 'emo'],
            confidence: 0.8,
            sources: ['https://saimtheband.bandcamp.com/album/precipitacions'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Sota Terra',
            channelIds: ['UCUTor5MG45HnmxOEc2HrUhA'],
            facets: ['crust', 'hardcore'],
            confidence: 0.8,
            sources: ['https://violenceintheveins.bandcamp.com/album/split-w-sota-terra-tempestat'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Tano!',
            channelIds: ['UCTgyTOC4u7Dw0AvH3-4uC9w'],
            facets: ['post-hardcore', 'hardcore', 'screamo', 'math-rock'],
            confidence: 0.8,
            sources: ['https://saltamarges.bandcamp.com/album/intanostellar'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'The Anti-Patiks',
            channelIds: ['UCARSXSWwSje53JsJgzLCtpA', 'UCuBUwUHwHaYGai1Enee7DSw'],
            facets: ['punk-rock'],
            confidence: 0.8,
            sources: ['https://the-anti-patiks.bandcamp.com/album/les-pitjors-can-ons-del-punk-rock-catal-2'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'The Demencials',
            channelIds: ['UCkbE2-0JpyMzPFxZJ9Ev8aA', 'UChFT46QMLdzzwd04aCTeyqg'],
            facets: ['oi', 'punk-rock'],
            confidence: 0.8,
            sources: ['https://www.wikidata.org/wiki/Q110485652'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Una Bèstia Incontrolable',
            channelIds: ['UCdvCXh3zd4i8SLE_l_6AEDw'],
            facets: ['hardcore', 'psychedelic', 'noise'],
            confidence: 0.8,
            sources: ['https://lavidaesunmus.bandcamp.com/album/observant-com-el-m-n-es-destrueix-lp'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Vàlius',
            channelIds: ['UCc20bll252Rwc71ILMnWVcA'],
            facets: [],
            confidence: 0,
            sources: ['https://valius.bandcamp.com/track/enguany'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
            reviewNote: 'Subestil pendent de documentar; afinitat neutral.',
            allowedVideoIdsByChannel: {
                UCc20bll252Rwc71ILMnWVcA: [
                    'TAPyhxHum_c',
                    'fzr3-1ECyJU',
                    'kxQPQ1FZ_Zk',
                    'wHcbtvlkFIo',
                    'KMT8Z-kqHGQ',
                    'XV76jIbppPs',
                    'cEqvxpHX5yM',
                    '2x048x1mTr0',
                    'O1rujubfYxs',
                    'QNJc3wQvwCw',
                    'Umz_6PFuB18',
                    '_lNyWJ_yK7k',
                    'ky8I3GyeyNg',
                    'ngNz0QjwQKg',
                    'rjFlkzRdEYw',
                    '7oxnizES3OE',
                    'IMKdVWZcdB8',
                    'RvkjyA5TOsg',
                    'jkB5tvtnEJU',
                    'vhf_0HKlIBk',
                    'Ivs1UY_Q-U8',
                    '9Y7DEW84fak',
                    '9pUv4_L1Qmw',
                    'AkV6QPdbIao',
                    'Gupf36LxEqc',
                    'Jh4hpy3l7FQ',
                    'KSJW3RWK10k',
                    'a2xV7AvZi2w',
                    'c5fQcNsQUlk',
                    'juTxNej5t2k',
                    'osxbPIfQxTc',
                    'pL-Gml2pZu8',
                    'FdYgAF0DTuw',
                    'cU3vtoh5B5U',
                    'y0hlTRGyITM',
                    'dw4QtRukKa8',
                    'WfooKX9eqIQ',
                    'yZKH03tulEs',
                    'vejkZfFrjIY',
                    'Jn5n2H-EQz8',
                    'fzAU9NHI_QA',
                    'HwAu3N4hVGs',
                ],
            },
        },
        {
            artist: 'Vicky l’Arròs',
            channelIds: ['UCl8a9NTTy-1sx1zB3lOAd5A'],
            facets: ['electropunk', 'grunge'],
            confidence: 0.8,
            sources: ['https://vickylarros.bandcamp.com/album/kitty'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'X-Fanekaes',
            channelIds: ['UCYcENw_M0RUKP-sXuR3odHQ'],
            facets: ['folk-punk', 'folk', 'punk-rock'],
            confidence: 0.8,
            sources: ['https://xfanekaes.bandcamp.com/album/sexe-cassalla-i-punkfolk'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
        {
            artist: 'Zombi Pujol',
            channelIds: ['UCHdLUidEVvmo-4p1h895hcA'],
            facets: ['punk-rock', 'garage-punk', 'hardcore'],
            confidence: 0.8,
            sources: ['https://zombipujol.bandcamp.com/album/imbecil-litat-t-ctica'],
            reviewedAt: '2026-10-13',
            categories: ['Punk'],
        },
    ];
    const detailedProfiles = [
        ...skaProfiles.map(profile => ({ ...profile, categories: [CATEGORY] })),
        ...heavyProfiles,
        ...punkProfiles,
    ];
    const catalog = window.SegueixMusicAffinityCatalog;
    const detailedByChannel = new Map();
    detailedProfiles.forEach(profile => profile.channelIds.forEach(id => detailedByChannel.set(id, profile)));
    const profiles = catalog
        ? catalog.profiles.map(base => {
              const detailed = base.channelIds.map(id => detailedByChannel.get(id)).find(Boolean);
              if (!detailed?.facets.length) return base;
              return {
                  ...base,
                  facets: detailed.facets,
                  confidence: detailed.confidence,
                  sources: detailed.sources,
                  reviewedAt: detailed.reviewedAt,
                  evidenceLevel: 'detailed',
                  ...(detailed.allowedVideoIdsByChannel
                      ? { allowedVideoIdsByChannel: detailed.allowedVideoIdsByChannel }
                      : {}),
              };
          })
        : detailedProfiles;
    const enabledCategories = catalog
        ? [...new Set(profiles.flatMap(profile => profile.categories))]
        : [CATEGORY, 'Heavy / Metal', 'Punk'];
    const relations = catalog?.relations || [];
    const singleSubcategory = catalog?.schemaVersion >= 2;
    const subcategories = catalog?.subcategories || [];
    const subcategoryById = new Map(subcategories.map(s => [s.id, s]));
    const minimumArtists = catalog?.minimumArtists || 5;
    // Compartir músics és una relació documental, no una mesura del so.
    function relationOf(left, right) {
        if (!left || !right || left.artist === right.artist) return null;
        return (
            relations.find(
                relation => relation.artists.includes(left.artist) && relation.artists.includes(right.artist)
            ) || null
        );
    }
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
        const channelId = video.channelId || video.snippet?.channelId;
        const profile = byChannel.get(channelId);
        // Canals compartits o homònims: només els vídeos identificats en la revisió del catàleg.
        if (profile?.allowedVideoIdsByChannel && !profile.allowedVideoIdsByChannel[channelId]?.includes(video.id)) {
            return null;
        }
        return profile || null;
    }

    function similarity(a, b) {
        const left = profileOf(a);
        const right = profileOf(b);
        if (singleSubcategory) {
            if (!left || !right) return 0.5;
            const style = subcategorySimilarity(left, right);
            // Els vincles personals/geogràfics només reforcen estils compatibles.
            if (style < 0.7) return style;
            const relation = relationOf(left, right);
            return Math.min(1, style + (relation ? 0.06 * relation.confidence : 0) + 0.02 * proximity(left, right));
        }
        if (!left || !right || !left.facets.length || !right.facets.length) return 0.5;
        const union = new Set([...left.facets, ...right.facets]);
        const common = left.facets.filter(facet => right.facets.includes(facet)).length;
        const confidence = Math.min(left.confidence, right.confidence);
        const style = 0.5 + ((union.size ? common / union.size : 0.5) - 0.5) * confidence;
        const relation = relationOf(left, right);
        return Math.min(1, style + (relation ? 0.08 * relation.confidence : 0));
    }

    function subcategorySimilarity(left, right) {
        if (!left?.subcategory || !right?.subcategory) return 0.5;
        if (left.subcategory === right.subcategory) return 0.9;
        if (subcategoryById.get(left.subcategory)?.neighbours.includes(right.subcategory)) return 0.7;
        return left.primaryCategory === right.primaryCategory ? 0.4 : 0.2;
    }

    function proximity(left, right) {
        let best = 0;
        for (const a of left.places || []) {for (const b of right.places || []) {
            if (a.id === b.id) return 1;
            const rad = Math.PI / 180;
            const h = Math.sin((a.latitude - b.latitude) * rad / 2) ** 2
                + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad)
                * Math.sin((a.longitude - b.longitude) * rad / 2) ** 2;
            const km = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
            best = Math.max(best, Math.max(0, 1 - km / 50));
        }}
        return best;
    }

    // El recompte és d'artistes amb cançons candidates, no de canals ni de pistes.
    // Amb menys de cinc, el nucli s'obre des del principi als subestils veïns.
    function radioContext(videos, seed) {
        if (!singleSubcategory) return null;
        const supply = new Map();
        for (const video of [...videos, seed].filter(Boolean)) {
            const profile = profileOf(video);
            if (!profile) continue;
            if (!supply.has(profile.subcategory)) supply.set(profile.subcategory, new Set());
            supply.get(profile.subcategory).add(profile.artist);
        }
        return {
            tier(candidate, previous) {
                const target = profileOf(seed) || profileOf(previous);
                const profile = profileOf(candidate);
                if (!target || !profile) return 2;
                if (profile.subcategory === target.subcategory) return 0;
                const neighbours = subcategoryById.get(target.subcategory)?.neighbours || [];
                if (neighbours.includes(profile.subcategory)) {
                    return (supply.get(target.subcategory)?.size || 0) < minimumArtists ? 0 : 1;
                }
                return 2;
            },
            minimumArtists,
            seedSubcategory: profileOf(seed)?.subcategory || null,
            seedArtists: supply.get(profileOf(seed)?.subcategory)?.size || 0,
        };
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
        relations,
        singleSubcategory,
        subcategories,
        subcategorySimilarity,
        proximity,
        radioContext,
        relationOf,
        similarity,
        isActive,
        transition,
    };
})(window);

