import { SAVED_DRIVERS_MAX, SAVED_DRIVERS_MAX_BYTES } from './types';
import type { SavedDriver, SavedDriverDraft } from './types';

// Arquivo .buildbass-drivers.json (specs/008, contracts/drivers-file.md): a cópia de segurança da
// lista "Meus alto-falantes" e a forma de levá-la a outro aparelho. Entrada não confiável.

export const DRIVERS_FILE_FORMAT = 'buildbass-drivers';
export const DRIVERS_FILE_VERSION = 1;
export const DRIVERS_FILE_NAME = 'meus-alto-falantes.buildbass-drivers.json';

export type DriversFileErrorCode =
    | 'fileTooLarge'
    | 'invalidJson'
    | 'notBuildbass'
    | 'newerVersion'
    | 'tooMany'
    | 'invalidContent'
    | 'readFailed';

export type ParseDriversResult =
    | { ok: true; drivers: SavedDriverDraft[] }
    | { ok: false; code: DriversFileErrorCode; path?: string };

// `id` e `savedAt` ficam de fora: são gerados ao importar.
export function exportSavedDrivers(
    items: SavedDriver[],
    now = new Date(),
): string {
    const drivers = items.map(
        ({ id: _id, savedAt: _savedAt, ...draft }) => draft,
    );

    return `${JSON.stringify(
        {
            format: DRIVERS_FILE_FORMAT,
            version: DRIVERS_FILE_VERSION,
            exported_at: now.toISOString(),
            drivers,
        },
        null,
        4,
    )}\n`;
}

export function downloadSavedDrivers(items: SavedDriver[]): void {
    const blob = new Blob([exportSavedDrivers(items)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = DRIVERS_FILE_NAME;
    link.click();
    // Revogar depois do clique: alguns navegadores leem o blob de forma assíncrona.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function parseSavedDriversFile(
    file: File,
): Promise<ParseDriversResult> {
    if (file.size > SAVED_DRIVERS_MAX_BYTES) {
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

    if (!record(raw) || raw.format !== DRIVERS_FILE_FORMAT) {
        return { ok: false, code: 'notBuildbass' };
    }

    if (
        typeof raw.version !== 'number' ||
        !Number.isInteger(raw.version) ||
        raw.version < 1
    ) {
        return { ok: false, code: 'invalidContent', path: 'version' };
    }

    if (raw.version > DRIVERS_FILE_VERSION) {
        return { ok: false, code: 'newerVersion' };
    }

    if (Array.isArray(raw.drivers) && raw.drivers.length > SAVED_DRIVERS_MAX) {
        return { ok: false, code: 'tooMany' };
    }

    const { savedDriversSchema } = await import('./schema');
    const parsed = savedDriversSchema.safeParse({ drivers: raw.drivers });

    if (!parsed.success) {
        const [issue] = parsed.error.issues;

        return {
            ok: false,
            code: 'invalidContent',
            path: issue.path.map(String).join('.'),
        };
    }

    return { ok: true, drivers: parsed.data.drivers };
}
