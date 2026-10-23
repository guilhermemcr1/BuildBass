import { exportBaseName } from '@/lib/project/file';
import type { ExportFormat, ExportKind } from './types';

const pad = (value: number) => String(value).padStart(2, '0');

// <projeto>-<gráfico>-AAAA-MM-DD.<png|pdf>: o nome do projeto passa pelo mesmo slug do arquivo de
// projeto (sem acento nem caractere inválido).
export function fileNameFor(
    projectName: string,
    kind: ExportKind,
    date: Date,
    format: ExportFormat,
): string {
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return `${exportBaseName(projectName)}-${kind}-${day}.${format}`;
}
