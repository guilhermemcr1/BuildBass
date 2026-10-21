import type { Cutout, PieceRole, Plan } from './types';

// Lista de corte em CSV (specs/005, research.md §9). Função pura: os números e os textos já
// chegam formatados na locale e na unidade ativas; aqui só se monta o arquivo.

export type CsvLabels = {
    columns: {
        piece: string;
        position: string;
        quantity: string;
        length: string;
        width: string;
        thickness: string;
        cutouts: string;
    };
    pieces: Record<PieceRole, string>;
    positions: Record<PieceRole, string>;
    dimensions: {
        title: string;
        width: string;
        height: string;
        depth: string;
        internal: string;
        external: string;
        rearDepth: string;
        frontDepth: string;
    };
    volume: {
        title: string;
        internal: string;
        braces: string;
        drivers: string;
        ports: string;
        net: string;
        simulated: string;
        difference: string;
        chambers: Record<'main' | 'rear' | 'front', string>;
    };
};

export type CsvFormat = {
    // Metros → texto na unidade ativa e na locale, sem o símbolo da unidade.
    number: (meters: number) => string;
    // Metros cúbicos → texto no volume ativo, sem o símbolo.
    volume: (cubicMeters: number) => string;
    percent: (ratio: number) => string;
    unitSymbol: string;
    volumeSymbol: string;
    decimalSeparator: string;
    // Recortes da peça em texto (já traduzido, com as medidas e a quantidade).
    cutouts: (cutouts: Cutout[]) => string[];
    labels: CsvLabels;
};

const BOM = '﻿';
const LINE_BREAK = '\r\n';
const CUTOUT_JOINER = ' + ';

function quote(field: string, separator: string): string {
    return field.includes(separator) ||
        field.includes('"') ||
        field.includes('\n') ||
        field.includes('\r')
        ? `"${field.replaceAll('"', '""')}"`
        : field;
}

export function cutPlanCsv(plan: Plan, format: CsvFormat): string {
    const { labels } = format;
    // pt-BR escreve 1.234,5 e separa lista com ";"; en escreve 1,234.5 e separa com ",".
    const separator = format.decimalSeparator === ',' ? ';' : ',';
    const line = (...fields: string[]) =>
        fields.map((field) => quote(field, separator)).join(separator);
    const withUnit = (label: string, unit: string) => `${label} (${unit})`;
    const rows: string[] = [];

    rows.push(
        line(
            labels.columns.piece,
            labels.columns.position,
            labels.columns.quantity,
            withUnit(labels.columns.length, format.unitSymbol),
            withUnit(labels.columns.width, format.unitSymbol),
            withUnit(labels.columns.thickness, format.unitSymbol),
            labels.columns.cutouts,
        ),
    );

    for (const piece of plan.pieces) {
        rows.push(
            line(
                labels.pieces[piece.role],
                labels.positions[piece.role],
                String(piece.quantity),
                format.number(Math.max(piece.w_m, piece.h_m)),
                format.number(Math.min(piece.w_m, piece.h_m)),
                format.number(piece.thickness_m),
                format.cutouts(piece.cutouts).join(CUTOUT_JOINER),
            ),
        );
    }

    const { internal, external, chambers } = plan.dimensions;
    const sizes = (size: typeof internal) => [
        format.number(size.w_m),
        format.number(size.h_m),
        format.number(size.d_m),
    ];

    rows.push(
        '',
        line(
            labels.dimensions.title,
            withUnit(labels.dimensions.width, format.unitSymbol),
            withUnit(labels.dimensions.height, format.unitSymbol),
            withUnit(labels.dimensions.depth, format.unitSymbol),
        ),
        line(labels.dimensions.internal, ...sizes(internal)),
        line(labels.dimensions.external, ...sizes(external)),
    );

    if (chambers !== undefined) {
        rows.push(
            line(
                withUnit(labels.dimensions.rearDepth, format.unitSymbol),
                format.number(chambers.rear_d_m),
            ),
            line(
                withUnit(labels.dimensions.frontDepth, format.unitSymbol),
                format.number(chambers.front_d_m),
            ),
        );
    }

    if (plan.volume.chambers.length > 0) {
        const volumeHeader = (label: string) =>
            withUnit(label, format.volumeSymbol);

        rows.push(
            '',
            line(
                labels.volume.title,
                volumeHeader(labels.volume.internal),
                volumeHeader(labels.volume.braces),
                volumeHeader(labels.volume.drivers),
                volumeHeader(labels.volume.ports),
                volumeHeader(labels.volume.net),
                volumeHeader(labels.volume.simulated),
                labels.volume.difference,
            ),
        );

        for (const chamber of plan.volume.chambers) {
            rows.push(
                line(
                    labels.volume.chambers[chamber.id],
                    format.volume(chamber.internal_m3),
                    format.volume(chamber.braces_m3),
                    format.volume(chamber.drivers_m3),
                    format.volume(chamber.ports_m3),
                    format.volume(chamber.net_m3),
                    chamber.simulated_m3 === undefined
                        ? ''
                        : format.volume(chamber.simulated_m3),
                    chamber.difference_ratio === undefined
                        ? ''
                        : format.percent(chamber.difference_ratio),
                ),
            );
        }
    }

    return `${BOM}${rows.join(LINE_BREAK)}${LINE_BREAK}`;
}
