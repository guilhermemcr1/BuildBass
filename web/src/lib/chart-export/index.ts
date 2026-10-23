import { fileNameFor } from './file-name';
import { sceneToPdf } from './pdf';
import { sceneToPng } from './raster';
import { buildScene } from './scene';
import { sceneToSvg } from './svg';
import type { ExportInput, ExportOptions } from './types';

export { availableGroups, effectiveGroups } from './legend';
export type { Availability } from './legend';
export { fileNameFor } from './file-name';
export { buildScene } from './scene';
export { sceneToPdf } from './pdf';
export { sceneToSvg } from './svg';
export * from './types';

export type ExportResult = { blob: Blob; fileName: string };

// Gera o arquivo da exportação a partir da mesma cena que a prévia mostra.
export async function exportChart(
    input: ExportInput,
    options: ExportOptions,
): Promise<ExportResult> {
    const scene = buildScene(input, options.groups);
    const fileName = fileNameFor(
        input.projects[0]?.name ?? '',
        input.kind,
        input.date,
        options.format,
    );

    if (options.format === 'pdf') {
        // A4 em português, Carta em inglês.
        const page = input.locale.startsWith('pt') ? 'a4' : 'letter';
        const bytes = sceneToPdf(scene, page);

        return {
            blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
            fileName,
        };
    }

    return { blob: await sceneToPng(sceneToSvg(scene)), fileName };
}
