import type { TFunction } from 'i18next';

// Projeto sem nome guarda '' e mostra o texto padrão no idioma ativo.
export function displayName(name: string, t: TFunction): string {
    return name.trim() === '' ? t('project:defaultName') : name;
}
