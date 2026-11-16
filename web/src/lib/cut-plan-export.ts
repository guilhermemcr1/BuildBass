import type { TFunction } from 'i18next';
import { cutPlanCsv } from '@/cutplan';
import type { CsvFormat, Plan, SheetLayout } from '@/cutplan';
import { cutoutSummary, pieceName, piecePosition } from '@/lib/cut-plan-text';
import { exportBaseName } from '@/lib/project/file';
import { fromSi } from '@/lib/units/convert';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { UnitSystem } from '@/lib/units/quantities';

const ROLES = ['front', 'back', 'top', 'bottom', 'side', 'divider'] as const;
const CHAMBERS = ['main', 'rear', 'front'] as const;
const TOTALS = [
    'title',
    'gross',
    'net',
    'difference',
    'pieces',
    'area',
    'cutLength',
] as const;
const SHEETS = [
    'title',
    'sheet',
    'piece',
    'unit',
    'x',
    'y',
    'length',
    'width',
    'rotated',
    'yes',
    'no',
    'utilization',
    'waste',
    'oversize',
    'stock',
    'unplaced',
    'cut',
    'guillotine',
    'free',
] as const;

function decimalSeparatorOf(locale: string): string {
    return (
        new Intl.NumberFormat(locale)
            .formatToParts(1.1)
            .find(({ type }) => type === 'decimal')?.value ?? '.'
    );
}

// Formatação do CSV na locale e na unidade ativas: números sem separador de milhar, para a
// planilha não confundir "1.234" com mil e duzentos.
export function csvFormatFor(
    locale: string,
    unitSystem: UnitSystem,
    t: TFunction,
): CsvFormat {
    const lengthUnit = defaultUnitFor('length', unitSystem);
    const volumeUnit = defaultUnitFor('volume', unitSystem);
    const areaUnit = defaultUnitFor('area', unitSystem);
    const numberIn = (unitId: typeof lengthUnit) => {
        const formatter = new Intl.NumberFormat(locale, {
            minimumFractionDigits: findUnit(unitId).decimals,
            maximumFractionDigits: findUnit(unitId).decimals,
            useGrouping: false,
        });

        return (si: number) => formatter.format(fromSi(si, unitId));
    };
    const percent = new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 4,
        useGrouping: false,
    });
    const text = (key: string) => t(`cutplan:${key}`);

    return {
        number: numberIn(lengthUnit),
        volume: numberIn(volumeUnit),
        area: numberIn(areaUnit),
        areaSymbol: findUnit(areaUnit).symbol,
        percent: (ratio) => percent.format(ratio),
        unitSymbol: findUnit(lengthUnit).symbol,
        volumeSymbol: findUnit(volumeUnit).symbol,
        decimalSeparator: decimalSeparatorOf(locale),
        cutouts: (cutouts) =>
            cutoutSummary(cutouts, {
                t,
                length: (si) => formatWithUnit(si, lengthUnit, locale),
            }),
        labels: {
            columns: {
                piece: text('parts.columns.piece'),
                position: text('parts.columns.position'),
                quantity: text('parts.columns.quantity'),
                length: text('parts.columns.length'),
                width: text('parts.columns.width'),
                thickness: text('parts.columns.thickness'),
                cutouts: text('parts.columns.cutouts'),
            },
            pieces: Object.fromEntries(
                ROLES.map((role) => [role, pieceName(role, t)]),
            ) as CsvFormat['labels']['pieces'],
            positions: Object.fromEntries(
                ROLES.map((role) => [role, piecePosition(role, t)]),
            ) as CsvFormat['labels']['positions'],
            dimensions: {
                title: text('dimensions.title'),
                width: text('dimensions.width'),
                height: text('dimensions.height'),
                depth: text('dimensions.depth'),
                internal: text('dimensions.internal'),
                external: text('dimensions.external'),
                rearDepth: text('dimensions.rearDepth'),
                frontDepth: text('dimensions.frontDepth'),
            },
            volume: {
                title: text('volume.title'),
                internal: text('volume.rows.internal'),
                braces: text('volume.rows.braces'),
                drivers: text('volume.rows.drivers'),
                ports: text('volume.rows.ports'),
                net: text('volume.rows.net'),
                simulated: text('volume.rows.simulated'),
                difference: text('volume.rows.difference'),
                chambers: Object.fromEntries(
                    CHAMBERS.map((id) => [id, text(`volume.chambers.${id}`)]),
                ) as CsvFormat['labels']['volume']['chambers'],
            },
            totals: Object.fromEntries(
                TOTALS.map((key) => [key, text(`totals.${key}`)]),
            ) as CsvFormat['labels']['totals'],
            sheets: Object.fromEntries(
                SHEETS.map((key) => [key, text(`sheets.${key}`)]),
            ) as CsvFormat['labels']['sheets'],
            cutouts: {
                title: text('csvCutouts.title'),
                cutout: text('csvCutouts.cutout'),
                size: text('csvCutouts.size'),
                fromLeft: text('csvCutouts.fromLeft'),
                fromBottom: text('csvCutouts.fromBottom'),
                position: text('csvCutouts.position'),
                manual: text('csvCutouts.manual'),
                auto: text('csvCutouts.auto'),
                driver: text('cutouts.driver'),
                port: text('cutouts.port'),
            },
        },
    };
}

export function cutPlanFileName(projectName: string): string {
    return `${exportBaseName(projectName)}-plano-de-corte.csv`;
}

export function downloadCutPlanCsv(
    plan: Plan,
    projectName: string,
    format: CsvFormat,
    layout?: SheetLayout,
): void {
    const blob = new Blob([cutPlanCsv(plan, format, layout)], {
        type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cutPlanFileName(projectName);
    link.click();
    // Revogar depois do clique: alguns navegadores leem o blob de forma assíncrona.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
