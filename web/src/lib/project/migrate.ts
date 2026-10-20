// Versão atual do arquivo .buildbass.json (contracts/project-file.md).
export const CURRENT_VERSION = 1;

// Migrações em cadeia: MIGRATIONS[i] leva o conteúdo da versão i + 1 para a i + 2. Vazia na v1;
// cada mudança de formato acrescenta uma função aqui e sobe CURRENT_VERSION.
const MIGRATIONS: ((project: unknown) => unknown)[] = [];

export function migrate(project: unknown, version: number): unknown {
    let current = project;

    for (let step = version; step < CURRENT_VERSION; step++) {
        current = MIGRATIONS[step - 1](current);
    }

    return current;
}
