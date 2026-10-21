// Versão atual do arquivo .buildbass.json (contracts/project-file.md). A 2 acrescenta a caixa
// bandpass (specs/004); só arquivos com esse tipo são gravados como v2 (file.ts).
export const CURRENT_VERSION = 2;

// Migrações em cadeia: MIGRATIONS[i] leva o conteúdo da versão i + 1 para a i + 2. A v1 → v2 só
// acrescenta campos opcionais, então o conteúdo passa como está; cada mudança de formato
// acrescenta uma função aqui e sobe CURRENT_VERSION.
const MIGRATIONS: ((project: unknown) => unknown)[] = [(project) => project];

export function migrate(project: unknown, version: number): unknown {
    let current = project;

    for (let step = version; step < CURRENT_VERSION; step++) {
        current = MIGRATIONS[step - 1](current);
    }

    return current;
}
