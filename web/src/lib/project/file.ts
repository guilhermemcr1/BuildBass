import { CURRENT_VERSION, migrate } from './migrate';
import type { ProjectData } from './types';

// Arquivo .buildbass.json (contracts/project-file.md): entrada não confiável, validada antes de
// chegar ao estado (constituição, princípio IV).

export const FILE_FORMAT = 'buildbass.project';
export const FILE_EXTENSION = '.buildbass.json';
export const MAX_FILE_BYTES = 256 * 1024;
const APP_VERSION = '0.4.0';

export type OpenErrorCode =
    | 'fileTooLarge'
    | 'invalidJson'
    | 'notBuildbass'
    | 'newerVersion'
    | 'invalidContent'
    | 'readFailed';

export type ParseResult =
    | { ok: true; data: ProjectData }
    | { ok: false; code: OpenErrorCode; path?: string };

// A versão gravada é a menor que descreve o arquivo: plano de corte editado = 3, bandpass = 2 e os
// demais continuam v1 e abrem em apps anteriores (specs/004 e specs/005, contracts/project-file.md).
function versionOf(data: ProjectData): number {
    if (data.cutPlan !== undefined) {
        return 3;
    }

    return data.box.type === 'bandpass' ? 2 : 1;
}

export function serializeProject(data: ProjectData, now = new Date()): string {
    return `${JSON.stringify(
        {
            format: FILE_FORMAT,
            version: versionOf(data),
            app: APP_VERSION,
            exported_at: now.toISOString(),
            project: data,
        },
        null,
        4,
    )}\n`;
}

// Nome em minúsculas, sem acentos, com espaços e símbolos trocados por "-"; vazio vira "projeto".
export function exportBaseName(name: string): string {
    const slug = name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return slug === '' ? 'projeto' : slug;
}

export function exportFileName(name: string): string {
    return `${exportBaseName(name)}${FILE_EXTENSION}`;
}

export function downloadProject(data: ProjectData): void {
    const blob = new Blob([serializeProject(data)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(data.name);
    link.click();
    // Revogar depois do clique: alguns navegadores leem o blob de forma assíncrona.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function parseProjectFile(file: File): Promise<ParseResult> {
    if (file.size > MAX_FILE_BYTES) {
        return { ok: false, code: 'fileTooLarge' };
    }

    let text: string;

    try {
        text = await file.text();
    } catch {
        return { ok: false, code: 'readFailed' };
    }

    let raw: unknown;

    try {
        raw = JSON.parse(text);
    } catch {
        return { ok: false, code: 'invalidJson' };
    }

    if (!record(raw) || raw.format !== FILE_FORMAT) {
        return { ok: false, code: 'notBuildbass' };
    }

    const { version } = raw;

    if (
        typeof version !== 'number' ||
        !Number.isInteger(version) ||
        version < 1
    ) {
        return { ok: false, code: 'invalidContent', path: 'version' };
    }

    if (version > CURRENT_VERSION) {
        return { ok: false, code: 'newerVersion' };
    }

    const { projectSchema } = await import('./schema');
    const parsed = projectSchema.safeParse(migrate(raw.project, version));

    if (!parsed.success) {
        const [issue] = parsed.error.issues;

        return {
            ok: false,
            code: 'invalidContent',
            path: ['project', ...issue.path.map(String)].join('.'),
        };
    }

    return { ok: true, data: parsed.data };
}
