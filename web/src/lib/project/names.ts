import type { TFunction } from 'i18next';

type Named = { data: { name: string }; slot: number };

// Projeto sem nome guarda '' e mostra o texto padrão no idioma ativo; do segundo em diante leva
// o número da cor (slot) para as abas não ficarem iguais.
export function displayName({ data, slot }: Named, t: TFunction): string {
    if (data.name.trim() !== '') {
        return data.name;
    }

    const base = t('project:defaultName');

    return slot === 1 ? base : `${base} ${slot}`;
}
