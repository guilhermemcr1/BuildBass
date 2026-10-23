import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { useCatalogGallery } from './catalog-gallery';

const IMAGES = [
    { url: 'https://x.test/a.webp', thumb_url: 'https://x.test/a_thumb.webp' },
];

describe('useCatalogGallery', () => {
    beforeEach(() => {
        localStorage.clear();
        useCatalogGallery.getState().clear();
    });

    test('guarda a galeria do último driver copiado', () => {
        useCatalogGallery.getState().set('triton\u0000tr 620\u0000', IMAGES);

        expect(useCatalogGallery.getState().current).toEqual({
            identity: 'triton\u0000tr 620\u0000',
            images: IMAGES,
        });
    });

    test('sem imagens não guarda nada e limpa a anterior', () => {
        useCatalogGallery.getState().set('a', IMAGES);
        useCatalogGallery.getState().set('b', []);

        expect(useCatalogGallery.getState().current).toBeUndefined();
    });

    test('clear esconde a galeria', () => {
        useCatalogGallery.getState().set('a', IMAGES);
        useCatalogGallery.getState().clear();

        expect(useCatalogGallery.getState().current).toBeUndefined();
    });

    test('não persiste no navegador', () => {
        useCatalogGallery.getState().set('a', IMAGES);

        expect(localStorage.length).toBe(0);
    });
});
