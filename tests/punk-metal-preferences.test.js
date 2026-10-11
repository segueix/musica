import { describe, it, expect } from 'vitest';
import { loadScript, createMockLocalStorage } from './setup.js';

describe('separació de les preferències Punk i Heavy / Metal', () => {
    it('conserva els dos estils i retira la categoria antiga de la navegació', () => {
        const storage = createMockLocalStorage();
        storage.setItem('catube_last_category', 'Punk / Metal');
        storage.setItem('catube_first_styles', JSON.stringify(['Rock', 'Punk / Metal']));
        storage.setItem('catube_last_radio', JSON.stringify({ category: 'Punk / Metal|Rock' }));
        storage.setItem('catube_view_state', JSON.stringify({ selectedCategory: 'Punk / Metal' }));
        loadScript('js/utils/storage.js', { localStorage: storage });
        expect(storage.getItem('catube_last_category')).toBe('Novetats');
        expect(JSON.parse(storage.getItem('catube_first_styles'))).toEqual(['Rock', 'Punk', 'Heavy / Metal']);
        expect(JSON.parse(storage.getItem('catube_last_radio')).category).toBe('Punk|Heavy / Metal|Rock');
        expect(JSON.parse(storage.getItem('catube_view_state')).selectedCategory).toBe('Novetats');
        loadScript('js/utils/storage.js', { localStorage: storage });
        expect(JSON.parse(storage.getItem('catube_first_styles'))).toEqual(['Rock', 'Punk', 'Heavy / Metal']);
    });
});
