// Versão atual do arquivo .buildbass.json (contracts/project-file.md). A 2 acrescenta a caixa
// bandpass (specs/004), a 3 a configuração do plano de corte (specs/005), a 4 a bandpass de 6ª
// ordem (specs/007), a 5 a cor do projeto (specs/008), a 6 as medidas do alto-falante e a 7 o
// estoque de chapas, o tipo de corte e a posição dos recortes (specs/012), e a 8 o enchimento da caixa,
// a correção de ponta do duto e o Le em 10 kHz (compatibilidade com o mercado); cada arquivo é gravado com
// a menor versão que o descreve (file.ts).
export const CURRENT_VERSION = 8;

// Migrações em cadeia: MIGRATIONS[i] leva o conteúdo da versão i + 1 para a i + 2. A v1 → v2, a
// v2 → v3 e as seguintes até a v6 → v7 só acrescentam campos opcionais, então o conteúdo passa como está; cada mudança de
// formato acrescenta uma função aqui e sobe CURRENT_VERSION.
const MIGRATIONS: ((project: unknown) => unknown)[] = [
    (project) => project,
    (project) => project,
    (project) => project,
    (project) => project,
    (project) => project,
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
