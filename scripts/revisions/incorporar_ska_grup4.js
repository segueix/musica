'use strict';
// Alta dels grups ska de la llista de l'usuari (2026-10-14) que encara no eren a la base.
// Sense API: només escriu la base d'artistes i els fitxers editorials. Les cançons les porta
// «Actualitzar feed només dels grups nous» (canal Tema primer: MUSIC_TOPIC_GOVERNANCE=apply).
// Idempotent: un artista que ja hi és es deixa com està.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const DATE = '2026-10-14';
const REPORT = 'docs/revisions/2026-10-14-ska4-alta.json';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const norm = s =>
    String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

// Municipis nous (GeoNames via open-meteo, com la resta de la base).
const PLACES = {
    'geonames:3129660': ['Arenys de Munt', 41.61424, 2.53972, 'Catalunya'],
    'geonames:3111003': ['Sallent', 41.82602, 1.8955, 'Catalunya'],
    'geonames:3119867': ['la Sénia', 40.63333, 0.28333, 'Catalunya'],
    'geonames:2513703': ['Montcada', 39.54555, -0.39551, 'País Valencià'],
    'geonames:3110101': ['Sant Quirze del Vallès', 41.53333, 2.08333, 'Catalunya'],
};
// Comarca sense municipi documentat: la capital en fa de referència al mapa i a «A prop teu».
const REGIONS = {
    'territory:selva': {
        name: 'la Selva',
        territory: 'Catalunya',
        capital: ['geonames:3109982', 'Santa Coloma de Farners', 41.86667, 2.66667],
    },
};

const topic = (id, name) => ({ id, name: name + ' - Topic', handle: null, type: 'topic' });
const official = (id, name, handle) => ({ id, name, handle, type: 'official' });

// Canal Tema sempre primer (primary). L'oficial s'hi afegeix pels videoclips.
const ARTISTS = [
    {
        name: 'AlQuadrat',
        slug: 'alquadrat',
        aliases: ['Al Quadrat'],
        territory: 'Catalunya',
        place: 'geonames:3110101',
        relation: 'origin',
        subcategory: 'ska-classic',
        facets: ['ska', 'reggae', 'rumba', 'pop'],
        channels: [
            topic('UCSyQZszUB66TBDSGfMDcGNg', 'AlQuadrat'),
            official('UCRy88DHkwZTozU2PfetY0bA', 'Al Quadrat', '@AlQuadratgrup'),
        ],
        basis: 'Projecte musical nascut el 2009 a Sant Quirze del Vallès; barreja rumba, ska, reggae i pop.',
        sources: ['https://www.timeout.cat/barcelona/ca/musica/alquadrat', 'https://www.viasona.cat/grup/alquadrat'],
        language: 'vigilats',
        languageReason:
            'Repertori majoritàriament en castellà (Gente conectada, Azúcar y sal…) amb cançons en català (Llençols, Tornarem a començar).',
    },
    {
        name: 'Atzembla',
        slug: 'atzembla',
        aliases: [],
        wikidataId: 'Q55811636',
        territory: 'País Valencià',
        place: 'geonames:2513703',
        relation: 'origin',
        subcategory: 'ska-punk',
        facets: ['ska', 'punk', 'rock'],
        channels: [
            topic('UC39UUfaafpeQRfaU5dcJ0ug', 'Atzembla'),
            official('UCG-fbhvlr6lGbl2DhKGFFhA', 'Atzembla', '@atzemblagrup'),
        ],
        basis: "Grup de Montcada (l'Horta Nord) format el 2008; punk, rock i ska.",
        sources: [
            'https://ca.wikipedia.org/wiki/Atzembla_(grup_musical)',
            'https://www.tresdeu.com/2018/08/atzembla-instint/',
            'docs/revisions/2026-10-14-ska3-atzembla.md',
        ],
        language: 'confianca',
    },
    {
        name: 'CampikiPugui',
        slug: 'campikipugui',
        aliases: [],
        territory: 'Catalunya',
        place: 'territory:selva',
        relation: 'origin',
        subcategory: 'ska-classic',
        facets: ['ska', 'reggae', 'rock'],
        // L'oficial són sobretot versions i vídeos promocionals: només el Tema (EP «Una altra nit», 2017).
        channels: [topic('UCB91Q5KFhtxFhqdnemnI5Ew', 'CampikiPugui')],
        basis: 'Grup de mestissatge ska, rock i reggae de la Selva (programació de Selva Cultura); EP «Una altra nit» (2017). Municipi no documentat.',
        sources: [
            'https://www.selvacultura.cat/ca/programacio/c/1795-campikipugui.html',
            'https://music.apple.com/us/artist/campikipugui/1209822356',
        ],
        language: 'confianca',
    },
    {
        name: 'Dring Dublé',
        slug: 'dring-duble',
        aliases: ['Dring Duble'],
        territory: 'Catalunya',
        place: 'geonames:3111199',
        relation: 'associated',
        subcategory: 'reggae',
        facets: ['reggae', 'dub', 'ska'],
        channels: [topic('UCgbhHxO5Pvf0pCYr6f-BNyw', 'Dring dublé')],
        basis: "Grup de dub i ska; el senzill «Crema'ls» (2002) es va gravar als Estudis Sa Iaia de Sabadell (ProDubSA, Ripollet). Vinculació, no municipi de formació.",
        sources: ['https://produbsa.bandcamp.com/album/dring-dubl-cremals-feat-lester-mc'],
        language: 'vigilats',
        languageReason:
            'Catàleg poc documentat: el canal Tema no mostra pistes des d’aquí; cal revisar cada cançó que arribi.',
    },
    {
        name: 'El Veïnat',
        slug: 'el-veinat',
        aliases: [],
        territory: 'Catalunya',
        place: 'geonames:3110516',
        relation: 'origin',
        subcategory: 'reggae',
        facets: ['reggae', 'ska'],
        channels: [
            topic('UC3rSnb7CCMA8IrOTEhwPuYg', 'El Veïnat'),
            official('UCW0x-9uiF7yZMI9hEYTVMDQ', 'El Veïnat', '@elveinatTV'),
        ],
        basis: 'Grup de reggae i ska de Vilassar de Mar nascut a finals del 2011 (Correllengua); disc «Perquè el món et senti».',
        sources: [
            'https://naciodigital.cat/osona/cultura-i-mitjans/el-moscou-estrena-terrassa-amb-el-concert-del-veinat.html',
        ],
        language: 'confianca',
    },
    {
        name: 'Eskassa Llibertat',
        slug: 'eskassa-llibertat',
        aliases: ['eskassallibertat'],
        territory: 'Catalunya',
        place: 'geonames:3108286',
        relation: 'origin',
        subcategory: 'ska-punk',
        facets: ['ska', 'punk', 'rock'],
        channels: [
            topic('UC1iF5VxSLKfoIzlpbtQVL5g', 'Eskassa Llibertat'),
            official('UC4BSwwuqk6O9ELABBgsgWGQ', 'eskassallibertat', '@eskassallibertat'),
        ],
        basis: 'Grup d’ska format a Terrassa el 2008; «Despertem!» (2010), «#SingleEskassa» (2012) i «Ràdio Llibertat» (2013).',
        sources: ['https://www.viasona.cat/grup/eskassa-llibertat', 'https://eskassallibertat.bandcamp.com/'],
        language: 'confianca',
    },
    {
        name: 'Kalabranda',
        slug: 'kalabranda',
        aliases: [],
        territory: 'Catalunya',
        place: 'geonames:3129660',
        relation: 'origin',
        subcategory: 'ska-classic',
        facets: ['ska', 'rock'],
        channels: [
            topic('UCjL17J5dAE9sMDuX4VvhP1Q', 'Kalabranda'),
            official('UCbxd8rksufs9jtwDGXrN8YQ', 'Kalabranda', '@kalabranda5262'),
        ],
        basis: "Banda d'Arenys de Munt (Aula de Música d'Arenys de Munt, cartell de les Festes del Remei 2019); disc «Desperta la fera».",
        sources: ['https://arenysdemunt-prd.diba.cat/media/import/documents/news/Cartell_Remei_Jove_2019.pdf'],
        language: 'confianca',
    },
    {
        name: 'Kòdul',
        slug: 'kodul',
        aliases: ['Kodul'],
        territory: 'Catalunya',
        place: 'geonames:3111003',
        relation: 'origin',
        subcategory: 'ska-punk',
        facets: ['ska', 'rock', 'punk'],
        channels: [
            topic('UC04isma3OjnDslXzt-Ed3Jw', 'Kòdul'),
            official('UCvvFaqxr4vKR-fuF87BwaYA', 'Kòdul', '@tvkodul'),
        ],
        basis: 'Banda festiva i reivindicativa de Sallent (Bages), activa uns 12 anys; darrer disc «Sense mirar enrere» (Propaganda pel Fet!, 2016).',
        sources: [
            'https://indicat.blogspot.com/2012/12/kodul-enceta-un-verkami-per-al-proper.html',
            'docs/revisions/2026-10-14-ska3-kodul.md',
        ],
        language: 'confianca',
    },
    {
        name: 'La Bundu Band',
        slug: 'la-bundu-band',
        aliases: ['bunduband'],
        territory: 'Catalunya',
        place: 'geonames:3129660',
        relation: 'origin',
        subcategory: 'reggae',
        facets: ['reggae', 'dub', 'ska', 'hip-hop'],
        channels: [
            topic('UCwPrdShME-yrqB1hDvkUqPw', 'La Bundu Band'),
            topic('UCeXegD6_JMqPbUBEzkGinHw', 'LA BUNDU BAND (QUIMERA RECORDS 2010))'),
            official('UCMr0zO3JvMllHSSfxSawDUQ', 'bunduband', '@bunduband'),
        ],
        basis: 'Banda del Maresme (Arenys de Munt); «Guerrer rebel» (Quimera, 2010), «Sembrant beats, recollint revolució» (Kasba, 2014) i «Cat Samurai».',
        sources: [
            'https://www.verkami.com/projects/7252-nou-disc-de-la-bundu-band-sembrant-beats-recollint-revolucio',
            'https://www.reverbnation.com/labunduband/songs',
        ],
        language: 'vigilats',
        languageReason: 'Hi ha títols en castellà (Fruta fresca) i col·laboracions: cal revisar cançó per cançó.',
    },
    {
        name: 'Mascarats',
        slug: 'mascarats',
        aliases: ['Mascarats Grup'],
        territory: 'Catalunya',
        place: 'geonames:3119867',
        relation: 'origin',
        subcategory: 'reggae',
        facets: ['reggae', 'rock', 'ska'],
        channels: [
            topic('UC9Ytb6_hvQB1cH5iLYGAYKg', 'Mascarats'),
            official('UCd8BT2JBV0_DQOKbseg7_4w', 'Mascarats Grup', '@MascaratsGrup'),
        ],
        basis: 'Grup de música reivindicativa format a la Sénia que barreja rock i reggae; «Trencarem l’imaginari» (2017) i «Distopia».',
        sources: ['https://www.youtube.com/channel/UC9Ytb6_hvQB1cH5iLYGAYKg', 'http://www.mascarats.cat'],
        language: 'confianca',
    },
    {
        name: 'Ovella Xao',
        slug: 'ovella-xao',
        aliases: [],
        territory: 'Catalunya',
        place: 'geonames:3111199',
        relation: 'origin',
        subcategory: 'ska-classic',
        facets: ['ska', 'mestissatge', 'rumba'],
        channels: [
            topic('UC61lW1hjlSwAgBDWO3yVRBw', 'Ovella Xao'),
            official('UCWwKFCPkzG5Njr-kcpl9dag', 'Ovella Xao', '@OvellaXao'),
        ],
        basis: 'Grup de música festiva nascut a Sabadell el 2014; «Trempera matinera», «#Pastureig» i «Cant corral» (2018).',
        sources: ['https://www.youtube.com/channel/UC61lW1hjlSwAgBDWO3yVRBw'],
        language: 'vigilats',
        languageReason: 'Algun títol en castellà (La canción del viajero): cal revisar cançó per cançó.',
    },
    {
        name: 'Repúblika Ska',
        slug: 'republika-ska',
        aliases: ['RepublikaSka', 'República Ska'],
        territory: 'Catalunya',
        place: 'geonames:3118514',
        relation: 'origin',
        subcategory: 'ska-classic',
        facets: ['ska', 'reggae'],
        channels: [
            topic('UCmKA6KQvu6Ol0gv7PHNMPqQ', 'Repúblika Ska'),
            official('UCa3diMkg9yChODo1MPUGgNw', 'RepublikaSka', '@RepublikaSka'),
        ],
        basis: 'Banda d’ska de Lleida formada el 2008; «Ja som aquí» (2011) i «Resistirem» (2013).',
        sources: [
            'https://www.auva.cat/entrevistem-a-republika-ska/',
            'https://www.segre.com/ca/cultura/231227/republika-ska-torna-als-escenaris-10-anys-despres_293231.html',
        ],
        language: 'confianca',
    },
    {
        name: 'Skafam',
        slug: 'skafam',
        aliases: [],
        territory: 'Catalunya',
        place: 'geonames:3129660',
        relation: 'origin',
        subcategory: 'ska-punk',
        facets: ['ska', 'punk', 'rock', 'reggae'],
        // Només el Tema català («Riem», Discmedi 2007). «SkaFam Music - Tema» és un altre artista (txec).
        channels: [topic('UCw9QWACP-8N1COxwr8u8Ckw', 'Skafam')],
        basis: "Skamot Antifeixista d'Arenys de Munt: ska-punk amb rock, funk i reggae; disc «Riem» (2007).",
        sources: ['https://www.decibel.cat/grups/grups.php?accio=grup&id=329', 'https://www.viasona.cat/grup/skafam'],
        language: 'confianca',
    },
    {
        name: 'Terra Ferma Ska Band',
        slug: 'terra-ferma-ska-band',
        aliases: ['Terra Ferma'],
        territory: 'Catalunya',
        place: 'geonames:3111933',
        relation: 'origin',
        subcategory: 'ska-classic',
        facets: ['ska', 'reggae', 'funk', 'rap'],
        channels: [
            topic('UCyS2GxjCglNX_8TY7LDlmlw', 'Terra Ferma Ska Band'),
            official('UCT3FFtIl_wpwLu0pL4ruUDA', 'Terra Ferma', '@TerraFermagrup'),
        ],
        basis: 'Projecte nascut a Reus el 2014; «Aixecant el vol» (2015), «Un brot de llum» (2018) i «Sobre viure» (2020).',
        sources: ['https://surtdecasa.cat/camp/musica/terra-ferma-un-brot-de-llum'],
        language: 'confianca',
    },
    {
        name: 'Trast',
        slug: 'trast',
        aliases: [],
        territory: 'Catalunya',
        place: 'territory:baix-llobregat',
        relation: 'origin',
        subcategory: 'ska-classic',
        facets: ['ska', 'mestissatge', 'reggae'],
        // N'hi ha uns quants «Trast - Tema» homònims (japonès, italià, txec): aquest és el de «Diari de matinada» i «Serem».
        channels: [
            topic('UCajdvXC8lGH7n7d8mrhyZJw', 'Trast'),
            official('UC0vBr1BrHrWE07vDPy1tQcw', 'Trast', '@trastmusica'),
        ],
        basis: 'Festa, mestissatge i compromís des del Baix Llobregat (canal oficial); «Diari de matinada», «El detonant» (2016) i «Serem».',
        sources: [
            'https://surtdecasa.cat/camp/agenda/bonobos-trast/52854',
            'https://www.youtube.com/channel/UC0vBr1BrHrWE07vDPy1tQcw',
        ],
        language: 'vigilats',
        languageReason: 'Alguna cançó en castellà (Somos lo que somos, amb Emon): cal revisar cançó per cançó.',
    },
];

function apply() {
    const now = new Date().toISOString();
    const db = read('data/artistes-musica.json');
    const origins = read('data/origens-artistes.json');
    const proximity = read('data/proximitat-musical.json');
    const taxonomy = read('data/music-subcategories.json');
    const reviews = read('data/music-affinity-review.json');
    const watch = read('data/artistes-vigilats-idioma.json');
    const names = read('data/noms-canals.json');
    const subcategories = new Set(taxonomy.subcategories.map(s => s.id));
    const knownChannels = new Map(db.artists.flatMap(a => (a.youtube?.channels || []).map(c => [c.id, a.name])));
    const report = {
        reviewedAt: now,
        method: 'Canals identificats a YouTube i YouTube Music (pistes, discos i descripció); origen amb fonts públiques. Sense API ni selecció per ID: el canal Tema mana.',
        artists: [],
        skipped: [],
    };

    for (const [id, [name, latitude, longitude, territory]] of Object.entries(PLACES)) {
        if (origins.places[id]) continue;
        origins.places[id] = {
            name,
            type: 'municipality',
            geonamesId: Number(id.split(':')[1]),
            coordinates: { latitude, longitude, precision: 'settlement_reference' },
            territory,
            source:
                'https://geocoding-api.open-meteo.com/v1/search?name=' +
                encodeURIComponent(name) +
                '&count=10&language=ca&format=json&countryCode=ES',
            checkedOn: DATE,
        };
    }
    for (const [id, r] of Object.entries(REGIONS)) {
        if (!origins.places[id])
            origins.places[id] = { name: r.name, type: 'region', coordinates: null, territory: r.territory };
        const [capId, capName, latitude, longitude] = r.capital;
        if (!proximity.places[capId] && !origins.places[capId]) {
            proximity.places[capId] = {
                name: capName,
                type: 'municipality',
                territory: r.territory,
                coordinates: { latitude, longitude },
                source:
                    'https://geocoding-api.open-meteo.com/v1/search?name=' +
                    encodeURIComponent(capName) +
                    '&language=ca',
                checkedOn: DATE,
            };
        }
        if (!proximity.references[id]) proximity.references[id] = { placeIds: [capId], kind: 'capital' };
    }

    for (const a of ARTISTS) {
        assert(subcategories.has(a.subcategory), 'Subcategoria desconeguda: ' + a.subcategory);
        assert(origins.places[a.place], 'Lloc desconegut: ' + a.place);
        const keys = new Set([a.name, ...a.aliases].map(norm));
        if (db.artists.some(x => [x.name, x.displayName, ...(x.aliases || [])].some(n => keys.has(norm(n))))) {
            report.skipped.push({ name: a.name, reason: 'Ja era a la base.' });
            continue;
        }
        for (const c of a.channels)
            assert(!knownChannels.has(c.id), 'Canal ja assignat a ' + knownChannels.get(c.id) + ': ' + c.id);
        const channels = a.channels.map((c, i) => ({ ...c, primary: i === 0 }));
        db.artists.push({
            name: a.name,
            aliases: a.aliases,
            genres: ['Ska / Reggae'],
            territories: [a.territory],
            languages: ['ca'],
            wikidataId: a.wikidataId || null,
            musicbrainzId: null,
            youtube: { channels },
            confidence: a.relation === 'origin' ? 'alta' : 'mitjana',
            reviewStatus: 'aprovat',
            active: true,
            sources: [...a.sources, 'genre:manual'],
            lastChecked: now,
            notes: a.basis + ' Alta de la llista ska de l’usuari: canal Tema prioritari. ' + REPORT,
            genreReview: { reviewedAt: DATE, method: 'source-review', sources: a.sources },
        });
        const key = 'artist:' + a.slug;
        origins.artists[key] = {
            name: a.name,
            status: 'validated',
            relation: a.relation,
            placeIds: [a.place],
            confidence: a.relation === 'origin' ? 'alta' : 'mitjana',
            basis: a.basis,
            sources: a.sources,
            reviewedOn: DATE,
            assignmentSource: 'manual-review',
            locked: true,
        };
        for (const c of channels) origins.channels[c.id] = key;
        // El nom de l'app per a tots els canals del grup (el de YouTube pot ser «bunduband», «RepublikaSka»…).
        for (const c of channels) if (c.name.replace(/ - Topic$/, '') !== a.name) names.overrides[c.id] = a.name;
        taxonomy.overrides[a.name] = { subcategory: a.subcategory, basis: a.basis, sources: a.sources };
        reviews.artists = reviews.artists.filter(x => x.artist !== a.name);
        reviews.artists.push({
            artist: a.name,
            genres: ['Ska / Reggae'],
            facets: a.facets,
            sources: a.sources,
            reviewedAt: DATE,
            confidence: 0.85,
            method: 'source-review',
        });
        const entry = { artista: a.name, aliases: a.aliases, canals: channels.map(c => c.id) };
        watch.confianca = watch.confianca.filter(x => (typeof x === 'string' ? x : x.artista) !== a.name);
        watch.vigilats = watch.vigilats.filter(x => x.artista !== a.name);
        if (a.language === 'vigilats')
            watch.vigilats.push({ ...entry, motiu: a.languageReason, fonts: [...a.sources, REPORT] });
        else watch.confianca.push(entry);
        report.artists.push({
            name: a.name,
            place: origins.places[a.place].name,
            relation: a.relation,
            category: 'Ska / Reggae',
            subcategory: a.subcategory,
            language: a.language,
            channels: channels.map(c => ({ id: c.id, type: c.type, primary: c.primary })),
        });
    }
    db.updatedAt = now;
    watch.updatedAt = DATE;
    write('data/artistes-musica.json', db);
    write('data/origens-artistes.json', origins);
    write('data/proximitat-musical.json', proximity);
    write('data/music-subcategories.json', taxonomy);
    write('data/music-affinity-review.json', reviews);
    write('data/artistes-vigilats-idioma.json', watch);
    write('data/noms-canals.json', names);
    write(REPORT, report);
    console.log(JSON.stringify({ added: report.artists.length, skipped: report.skipped.length }));
}

apply();
