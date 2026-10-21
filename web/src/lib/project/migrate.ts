// Versão atual do arquivo .buildbass.json (contracts/project-file.md). A 2 acrescenta a caixa
// bandpass (specs/004) e a 3 a configuração do plano de corte (specs/005); cada arquivo é gravado
// com a menor versão que o descreve (file.ts).
export const CURRENT_VERSION = 3;

// Migrações em cadeia: MIGRATIONS[i] leva o conteúdo da versão i + 1 para a i + 2. A v1 → v2 e a
// v2 → v3 só acrescentam campos opcionais, então o conteúdo passa como está; cada mudança de
// formato acrescenta uma função aqui e sobe CURRENT_VERSION.
const MIGRATIONS: ((project: unknown) => unknown)[] = [
    (project) => project,
    (project) => project,
];

export function migrate(project: unknown, version: number): unknown {
    let current = project;

    for (let step = version; step < CURRENT_VERSION; step++) {
        current = MIGRATIONS[step - 1](current);
    }

    return current;
}
