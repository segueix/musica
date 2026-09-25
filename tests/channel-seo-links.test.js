import { describe, expect, it } from 'vitest';
import { loadScript } from './setup.js';

function loadChannelFeature() {
    return loadScript('js/features/channel.js');
}

describe('enllaços SEO de creador dins la PWA', () => {
    it('normalitza noms amb accents a slugs llegibles', () => {
        const ctx = loadChannelFeature();
        expect(ctx.SegueixApp.features.channel.slugifyCreatorName('À Punt Mèdia')).toBe('a-punt-media');
        expect(ctx.SegueixApp.features.channel.slugifyCreatorName('La Dimoni de Maxwell')).toBe('la-dimoni-de-maxwell');
    });

    it('resol col·lisions amb slugs diferents i estables', () => {
        const ctx = loadChannelFeature();
        const records = ctx.SegueixApp.features.channel.buildCreatorRecords([
            { id: 'UC_aaaa1111', name: 'Canal Igual' },
            { id: 'UC_bbbb2222', name: 'Canal Igual' },
        ]);

        expect(records).toHaveLength(2);
        expect(records[0].slug).not.toBe(records[1].slug);
        expect(records.every((item) => item.slug.startsWith('canal-igual-'))).toBe(true);
    });

    it('manté una URL funcional amb ID si el mapa de slugs encara no s’ha carregat', () => {
        const ctx = loadChannelFeature();
        expect(ctx.SegueixApp.features.channel.creatorHref('UC_test_creator')).toBe('/creador/UC_test_creator');
    });
});
