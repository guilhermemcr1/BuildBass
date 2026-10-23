import { create } from 'zustand';
import type { DriverImageRef } from '@/lib/catalog/types';

type CatalogGalleryState = {
    // Galeria do último driver copiado do catálogo. `identity` é o `identityOf` dele: a galeria só
    // aparece enquanto a identificação do projeto continuar a mesma.
    current: { identity: string; images: DriverImageRef[] } | undefined;
    set: (identity: string, images: DriverImageRef[]) => void;
    clear: () => void;
};

// Só em memória, de propósito (specs/010, R10): o projeto não aponta de volta ao catálogo e o
// arquivo `.buildbass.json` não leva imagens. Recarregar a página ou mudar a identidade esconde.
export const useCatalogGallery = create<CatalogGalleryState>()((set) => ({
    current: undefined,
    set: (identity, images) =>
        set({
            current: images.length === 0 ? undefined : { identity, images },
        }),
    clear: () => set({ current: undefined }),
}));
