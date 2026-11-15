import type { SheetLayout } from './nesting';
import { cutTotals } from './totals';
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
    totals: {
        title: string;
        gross: string;
        net: string;
        difference: string;
        pieces: string;
        area: string;
        cutLength: string;
    };
    sheets: {
        title: string;
        sheet: string;
        piece: string;
        unit: string;
        x: string;
        y: string;
        length: string;
        width: string;
        rotated: string;
        yes: string;
        no: string;
        utilization: string;
        waste: string;
        oversize: string;
        // Estoque e tipo de corte (specs/012).
        stock: string;
        unplaced: string;
        cut: string;
        guillotine: string;
        free: string;
    };
    // Centro de cada recorte (specs/012, FR-017).
    cutouts: {
        title: string;
        cutout: string;
        size: string;
        fromLeft: string;
        fromBottom: string;
        position: string;
        manual: string;
        auto: string;
        driver: string;
        port: string;
    };
};

export type CsvFormat = {
    // Metros → texto na unidade ativa e na locale, sem o símbolo da unidade.
    number: (meters: number) => string;
    // Metros cúbicos → texto no volume ativo, sem o símbolo.
    volume: (cubicMeters: number) => string;
    percent: (ratio: number) => string;
    // Metros quadrados → texto na área ativa, sem o símbolo.
    area: (squareMeters: number) => string;
    areaSymbol: string;
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

export function cutPlanCsv(
    plan: Plan,
    format: CsvFormat,
    layout?: SheetLayout,
): string {
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

    const placed = plan.pieces.flatMap((piece) =>
        piece.cutouts.flatMap((cutout) =>
            cutout.ref === undefined || cutout.center === undefined
                ? []
                : [{ piece, cutout, ref: cutout.ref, center: cutout.center }],
        ),
    );

    if (placed.length > 0) {
        const text = labels.cutouts;

        rows.push(
            '',
            line(
                text.title,
                labels.columns.piece,
                text.cutout,
                text.size,
                withUnit(text.fromLeft, format.unitSymbol),
                withUnit(text.fromBottom, format.unitSymbol),
                text.position,
            ),
        );

        for (const { piece, cutout, ref, center } of placed) {
            rows.push(
                line(
                    '',
                    labels.pieces[piece.role],
                    `${text[ref.kind]} ${ref.n}`,
                    format.cutouts([cutout]).join(CUTOUT_JOINER),
                    format.number(center.x_m),
                    format.number(center.y_m),
                    cutout.manual === true ? text.manual : text.auto,
                ),
            );
        }
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

    const { totals: text } = labels;
    const totals = cutTotals(plan);
    const basis = (label: string, value: typeof totals.gross) =>
        line(
            label,
            String(value.pieces),
            format.area(value.area_m2),
            format.number(value.cutLength_m),
        );

    rows.push(
        '',
        line(
            text.title,
            text.pieces,
            withUnit(text.area, format.areaSymbol),
            withUnit(text.cutLength, format.unitSymbol),
        ),
        basis(text.gross, totals.gross),
        basis(text.net, totals.net),
        basis(text.difference, totals.difference),
    );

    if (layout !== undefined) {
        const sheets = labels.sheets;

        rows.push(
            '',
            line(
                sheets.title,
                sheets.sheet,
                sheets.stock,
                sheets.piece,
                sheets.unit,
                withUnit('x', format.unitSymbol),
                withUnit('y', format.unitSymbol),
                withUnit(sheets.length, format.unitSymbol),
                withUnit(sheets.width, format.unitSymbol),
                sheets.rotated,
            ),
        );

        for (const [index, sheet] of layout.sheets.entries()) {
            for (const placement of sheet.placements) {
                rows.push(
                    line(
                        '',
                        String(index + 1),
                        String(sheet.stock + 1),
                        labels.pieces[placement.role],
                        String(placement.unit),
                        format.number(placement.x_m),
                        format.number(placement.y_m),
                        format.number(placement.w_m),
                        format.number(placement.h_m),
                        placement.rotated ? sheets.yes : sheets.no,
                    ),
                );
            }
        }

        rows.push(
            line(sheets.cut, sheets[layout.cut]),
            line(sheets.utilization, format.percent(layout.utilization)),
            line(
                withUnit(sheets.waste, format.areaSymbol),
                format.area(layout.waste_m2),
            ),
        );

        for (const missing of layout.oversize) {
            rows.push(
                line(
                    sheets.oversize,
                    labels.pieces[missing.role],
                    String(missing.unit),
                ),
            );
        }

        for (const missing of layout.unplaced) {
            rows.push(
                line(
                    sheets.unplaced,
                    labels.pieces[missing.role],
                    String(missing.unit),
                ),
            );
        }
    }

    return `${BOM}${rows.join(LINE_BREAK)}${LINE_BREAK}`;
}
