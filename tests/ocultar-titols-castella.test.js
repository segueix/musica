import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const { esCastella } = createRequire(import.meta.url)('../scripts/ocultar_titols_castella.js');
const song = (channelTitle, title) => ({ channelTitle, title, contentType: 'song' });

describe('Repúblika Ska: baixa editorial persistent', () => {
    it('retira Mi Amigo José del canal oficial i dels canals automàtics', () => {
        for (const canal of ['RepublikaSka', 'Repúblika Ska', 'Repúblika Ska - Topic', 'Repúblika Ska - Tema']) {
            expect(esCastella(song(canal, '06. MI AMIGO JOSÉ - REPÚBLIKA SKA (JA SOM AQUÍ!)'))).toBe(true);
            expect(esCastella(song(canal, 'Mi amigo Jose'))).toBe(true);
            expect(esCastella(song(canal, 'Entre llençols'))).toBe(false);
        }
        expect(esCastella(song('Un altre artista', 'Mi amigo José'))).toBe(false);
    });
});

describe('AlQuadrat: revisió de títols i lletres del 2026-10-14', () => {
    const canals = ['AlQuadrat', 'Al Quadrat', 'AlQuadrat - Topic', 'Al Quadrat - Topic'];

    it('retira els títols castellans i les lletres castellanes amb títol ambigu', () => {
        for (const canal of canals) {
            for (const title of ['A NINGÚN LUGAR', 'Nubes', 'AlQuadrat - Alegria y Verbena',
                'Enséñame A Querer La Vida', 'Que difícil', 'Arenal', 'Shia', 'Pamamá', 'Blanca', 'La guitarra',
                'Presente', 'AlQuadrat - 16. Presente']) {
                expect(esCastella(song(canal, title)), `${canal}: ${title}`).toBe(true);
                expect(esCastella({ ...song(canal, title + ' (Live)'), contentType: 'live_song' })).toBe(true);
                expect(esCastella(song('Altre artista', title))).toBe(false);
            }
        }
    });

    it('preserva les peces catalanes, també quan el títol cita el disc Presente', () => {
        for (const canal of canals) {
            for (const title of ['Cada nit', "Deixa'm respirar", 'Tornarem a Començar',
                'AlQuarat - 04. Llençols', 'Llençols (Presente, 2013)', 'Sent la Fragancia',
                'Sent la Fragància', 'Soc igual que ahir', "T'estimo prou", 'Una Vida Esperant-nos',
                'Festa Barrakes 2018', 'La Rumbia (ft. Marta Trujillo)', 'Formar Part del Mon']) {
                expect(esCastella(song(canal, title)), `${canal}: ${title}`).toBe(false);
            }
        }
        expect(esCastella({ ...song('AlQuadrat', 'Gente conectada (Making Of)'), contentType: 'other' })).toBe(false);
    });

    it('materialitza totes les còpies revisades, incloses les de fora del feed', () => {
        const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
        const review = read('docs/revisions/2026-10-14-alquadrat-idioma.json');
        const hidden = new Set(read('data/hidden-videos.json').videoIds);
        for (const video of review.removed) expect(hidden.has(video.id), video.title).toBe(true);
        for (const video of review.removedPromotions) expect(hidden.has(video.id), video.title).toBe(true);
        for (const video of review.retained) expect(hidden.has(video.id), video.title).toBe(false);
        expect(hidden.has('niwuifAO84U')).toBe(true); // Shia, canal oficial (arxiu).
        expect(hidden.has('5d9N8vjRjhY')).toBe(true); // Shia, canal Tema.
        expect(hidden.has('sMVIzu7NgDs')).toBe(true); // Arenal, còpia del recopilatori.
    });
});

describe('ocultar cançons amb títol en castellà', () => {
    it('detecta títols en castellà revisats a mà', () => {
        expect(esCastella(song('MARLENA', 'MARLENA - Nadie Se Muere De Amor'))).toBe(true);
        expect(esCastella(song('Ceaxe', 'POR PRIMERA VEZ - CEAXE'))).toBe(true);
        expect(esCastella(song('Judit Neddermann', 'Llévame Contigo'))).toBe(true);
        expect(esCastella(song('Judit Neddermann', 'Mendien Artean'))).toBe(true);
        expect(esCastella(song('SUU', 'Suu - Eres un temazo (Video Oficial)'))).toBe(true);
        expect(esCastella(song('SUU', 'Suu - Tranqüilo'))).toBe(true);
        expect(esCastella(song('Miki Nuñez', 'Miki Núñez - Viento Y Vida'))).toBe(true);
        expect(esCastella(song('31 FAM', 'NO LE DURA - 31FAM (Audio)'))).toBe(true);
        expect(esCastella(song('Julieta', 'Julieta - Si tienes frío (Audio Oficial)'))).toBe(true);
        expect(esCastella(song('Sexenni', 'Sexenni - Antipánico (Lyric Video)'))).toBe(true);
        expect(esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Vencidos'))).toBe(true);
        expect(esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Tarres (Actuación TVE)'))).toBe(true);
    });

    it('conserva els títols en català del mateix canal o artista', () => {
        expect(esCastella(song('Ceaxe', 'AQUELLA NIT - CEAXE'))).toBe(false);
        expect(esCastella(song('Judit Neddermann', 'Els Teus Ulls'))).toBe(false);
        expect(esCastella(song('Judit Neddermann', 'Primavera'))).toBe(false);
        expect(esCastella(song('SUU', 'Suu - Tant de bo (Video Oficial)'))).toBe(false);
        expect(esCastella(song('SUU', 'Suu - Parlant de tu'))).toBe(false);
        expect(esCastella(song('31 FAM', 'PER LA BONA GENT - 31FAM (Audio)'))).toBe(false);
        expect(esCastella(song('Julieta', 'Julieta - Ni llum ni lluna (Audio Oficial)'))).toBe(false);
        expect(esCastella(song('Sexenni', 'Sexenni - Mòbil, claus i cartera (Videoclip Oficial)'))).toBe(false);
        expect(esCastella(song('miquel', "miquel - L'amor en tu (Videolyric)"))).toBe(false);
        expect(
            esCastella(song('Joan Manuel Serrat', 'Joan Manuel Serrat - Per al Meu Amic (Concierto (Actuación TVE))'))
        ).toBe(false);
        expect(esCastella(song('Joan Manuel Serrat', "Joan Manuel Serrat - Paraules D'Amor (Cover Audio)"))).toBe(
            false
        );
    });

    it('revisió del 2026-10-02: castellà i altres llengües dels artistes amb canal Tema', () => {
        expect(esCastella(song('Txarango', 'Corazón Viajero'))).toBe(true);
        expect(esCastella(song('Txarango', 'Mr. Tambourine Man'))).toBe(true);
        expect(esCastella(song('Txarango', 'Meravellós Regal'))).toBe(false);
        expect(esCastella(song('Txarango', 'MIL OCELLS - Txarango feat. Jarabe de Palo'))).toBe(false);
        expect(esCastella(song('Sandra Bautista', 'Sandra Bautista - El último gol Live (Toma 3: Live Session)'))).toBe(
            true
        );
        expect(esCastella(song('Sandra Bautista', 'Darrere el foc'))).toBe(false);
        expect(esCastella(song('Sílvia Pérez Cruz', 'É triste viver sem seu amor'))).toBe(true);
        expect(esCastella(song('Sílvia Pérez Cruz', 'Mar de Na Catalina'))).toBe(false);
        expect(esCastella(song('El Pony Pisador', 'Wellerman'))).toBe(true);
        expect(esCastella(song('El Pony Pisador', 'Tot és part de ser un pirata'))).toBe(false);
        expect(esCastella(song('Mariona Escoda', 'Juno (Acústic en directe)'))).toBe(true);
        expect(esCastella(song('Mariona Escoda', 'Requiem (Acústic en directe)'))).toBe(true);
        expect(esCastella(song('Mariona Escoda - Topic', "Everybody's changing (Acústic en directe)"))).toBe(true);
        expect(esCastella(song('Mariona Escoda', 'Maniac (Acústic en directe)'))).toBe(true);
        expect(esCastella(song('Mariona Escoda - Topic', 'Maniac'))).toBe(true);
        expect(esCastella(song('Mariona Escoda', 'Et deixo la mà (Acústic en directe)'))).toBe(false);
        expect(esCastella(song('DAVEU', 'MI BRODA'))).toBe(true);
        expect(esCastella(song('DAVEU))', 'DAVEU)) - MI BRODA'))).toBe(true);
        expect(esCastella(song("VEN'NUS", "VEN'NUS - I JAZZ WANT MY G BACK (livesession)"))).toBe(true);
        expect(esCastella(song("Ven'nus", 'Carmen se fue'))).toBe(true);
        expect(esCastella(song("Ven'nus", "It's So Hard To Be So Funny"))).toBe(true);
        expect(esCastella(song("Ven'nus", 'TAN LEN'))).toBe(false);
        expect(esCastella(song("VEN'NUS", 'Cabells Mullats - Ven\'nus (Videoclip Oficial)'))).toBe(false);
        // Els dos noms d'un mateix artista (canal oficial i Tema) i la regla antiga es mantenen
        expect(esCastella(song('Miki Núñez', 'Quédate En Madrid'))).toBe(true);
        expect(esCastella(song('Miki Nuñez', 'Miki Núñez - Viento Y Vida'))).toBe(true);
        expect(esCastella(song('Miki Núñez', 'Ara'))).toBe(false);
        // Límits de paraula amb accents: «Todo» no és dins de «Tot»; «Tiempo» no toca «Temps»
        expect(esCastella(song('Sara Roy', 'Sara Roy - Todo (Acústico)'))).toBe(true);
        expect(esCastella(song('Sara Roy', 'Sara Roy - Roses'))).toBe(false);
        expect(esCastella(song('Sara Roy', 'TOCAR EL CEL - Sara Roy'))).toBe(false);
    });

    it('revisió del 2026-10-05: Au Rora conserva només les tres darreres peces en català', () => {
        expect(esCastella(song('Au Rora', 'Au Rora — How Long Are We Supposed To Wait'))).toBe(true);
        expect(esCastella(song('Au Rora', 'Au Rora — How Does It Feel (Live 2024)'))).toBe(true);
        expect(esCastella(song('Au Rora', 'Au Rora — Naïve'))).toBe(true);
        expect(esCastella(song('Au Rora', 'Blessed — Daniel Caesar cover by Au Rora'))).toBe(true);
        expect(esCastella(song('Au Rora', 'Au Rora — Tipsy'))).toBe(true);
        expect(esCastella(song('Au Rora', "Veure't Marxar — Au Rora"))).toBe(false);
        expect(esCastella(song('Au Rora', 'Au Rora — Espero No Arribar Tard (Live a Betevé)'))).toBe(false);
        expect(esCastella(song('Au Rora', 'Au Rora — Espero No Arribar Tard'))).toBe(false);
    });

    it('retira les lletres no catalanes de Stay Homas i La Pegatina també en directe', () => {
        expect(esCastella(song('STAY HOMAS', 'STAY HOMAS - RADE BLUNNER (Unplugged)'))).toBe(true);
        expect(esCastella(song('Stay Homas', 'Del Revés'))).toBe(true);
        expect(esCastella(song('Stay Homas', 'TROPICAL.mp3'))).toBe(true);
        expect(esCastella(song('La Pegatina', 'Sonqueson'))).toBe(true);
        expect(esCastella(song('La Pegatina - Topic', 'Non è facile (Live 2024)'))).toBe(true);
        expect(esCastella(song('Stay Homas', '+='))).toBe(false);
        expect(esCastella(song('STAY HOMAS', 'STAY HOMAS - HO TORNARIA A FER (Unplugged)'))).toBe(false);
        expect(esCastella(song('La Pegatina', 'Gat Rumberu'))).toBe(false);
        expect(esCastella(song('La Pegatina', "Que t'agradi veure'm"))).toBe(false);
        expect(esCastella(song('La Pegatina', 'La guspira'))).toBe(false);
    });

    it('només afecta cançons i canals de la llista', () => {
        expect(esCastella({ channelTitle: 'MARLENA', title: 'entrevista', contentType: 'review' })).toBe(false);
        expect(esCastella(song('Altre canal', 'Nadie Se Muere De Amor'))).toBe(false);
    });
});


describe('Adala: exclusions editorials i anglès', () => {
    it('oculta les peces també en directe i preserva el repertori català', () => {
        for (const title of ["Bala Perdida","Cold In Paradise","December","What Can I Say","Look Inside","Mr Fireman","Mr. Fireman","Money"]) {
            expect(esCastella(song('Adala', title))).toBe(true);
            expect(esCastella({ ...song('Adala - Topic', title + ' (Live)'), contentType: 'live_song' })).toBe(true);
            expect(esCastella(song('Altre artista', title))).toBe(false);
        }
        for (const title of ['Drames', 'Quantes Pluges', 'Dama', 'No Plou', 'El foc que mou la Terra']) {
            expect(esCastella(song('Adala', title))).toBe(false);
        }
    });
});
