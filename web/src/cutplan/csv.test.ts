import { describe, expect, test } from 'vite-plus/test';
import { cutPlanCsv } from './csv';
import type { CsvFormat } from './csv';
import type { Plan } from './types';

const LABELS: CsvFormat['labels'] = {
    columns: {
        piece: 'Peça',
        position: 'Posição',
        quantity: 'Qtd',
        length: 'Comprimento',
        width: 'Largura',
        thickness: 'Espessura',
        cutouts: 'Recortes',
    },
    pieces: {
        front: 'Frente',
        back: 'Fundo',
        top: 'Topo',
        bottom: 'Base',
        side: 'Lateral',
        divider: 'Divisória',
    },
    positions: {
        front: 'Painel da frente',
        back: 'Painel de trás',
        top: 'Face de cima',
        bottom: 'Face de baixo',
        side: 'Lados esquerdo e direito',
        divider: 'Entre as câmaras',
    },
    dimensions: {
        title: 'Dimensões',
        width: 'Largura',
        height: 'Altura',
        depth: 'Profundidade',
        internal: 'Internas',
        external: 'Externas',
        rearDepth: 'Profundidade da câmara traseira',
        frontDepth: 'Profundidade da câmara frontal',
    },
    volume: {
        title: 'Conferência de volume',
        internal: 'Interno',
        braces: 'Reforços',
        drivers: 'Drivers',
        ports: 'Dutos',
        net: 'Líquido',
        simulated: 'Simulado',
        difference: 'Diferença',
        chambers: {
            main: 'Caixa',
            rear: 'Câmara traseira',
            front: 'Câmara frontal',
        },
    },
};

function format(decimal: ',' | '.'): CsvFormat {
    const text = (value: number, digits: number) =>
        value.toFixed(digits).replace('.', decimal);

    return {
        number: (m) => text(m * 1000, 1),
        volume: (m3) => text(m3 * 1000, 1),
        percent: (ratio) => `${text(ratio * 100, 2)} %`,
        unitSymbol: 'mm',
        volumeSymbol: 'L',
        decimalSeparator: decimal,
        cutouts: (cutouts) =>
            cutouts.map(({ kind, diameter_m }) =>
                diameter_m === undefined
                    ? kind
                    : `${kind} Ø ${text(diameter_m * 1000, 1)} mm`,
            ),
        labels: LABELS,
    };
}

const PLAN: Plan = {
    boxType: 'vented',
    thickness_m: 0.018,
    dimensions: {
        internal: { w_m: 0.4, h_m: 0.6, d_m: 0.25 },
        external: { w_m: 0.436, h_m: 0.636, d_m: 0.286 },
    },
    pieces: [
        {
            role: 'front',
            quantity: 1,
            w_m: 0.436,
            h_m: 0.636,
            thickness_m: 0.018,
            cutouts: [
                { kind: 'driver', shape: 'round', diameter_m: 0.285 },
                { kind: 'port', shape: 'round', diameter_m: 0.1 },
            ],
        },
        {
            role: 'side',
            quantity: 2,
            w_m: 0.268,
            h_m: 0.6,
            thickness_m: 0.018,
            cutouts: [],
        },
    ],
    volume: {
        chambers: [
            {
                id: 'main',
                internal_m3: 0.063,
                braces_m3: 0.003,
                drivers_m3: 0.002,
                ports_m3: 0.001,
                net_m3: 0.057,
                simulated_m3: 0.057,
                difference_ratio: 0,
            },
        ],
        matchesSimulation: true,
    },
    warnings: [],
};

// Leitor mínimo de CSV: aspas duplas, separador configurável, CRLF.
function parse(csv: string, separator: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    const text = csv.replace(/^﻿/, '');

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (quoted) {
            if (char === '"' && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === separator) {
            row.push(field);
            field = '';
        } else if (char === '\r' && text[index + 1] === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            index += 1;
        } else {
            field += char;
        }
    }

    return rows;
}

describe('cutPlanCsv (C14)', () => {
    test('começa com BOM e termina com quebra de linha', () => {
        const csv = cutPlanCsv(PLAN, format(','));

        expect(csv.startsWith('﻿')).toBe(true);
        expect(csv.endsWith('\r\n')).toBe(true);
    });

    test('pt-BR: separador ";" e vírgula decimal', () => {
        const csv = cutPlanCsv(PLAN, format(','));
        const rows = parse(csv, ';');

        expect(rows[0]).toEqual([
            'Peça',
            'Posição',
            'Qtd',
            'Comprimento (mm)',
            'Largura (mm)',
            'Espessura (mm)',
            'Recortes',
        ]);
        expect(rows[2]).toEqual([
            'Lateral',
            'Lados esquerdo e direito',
            '2',
            '600,0',
            '268,0',
            '18,0',
            '',
        ]);
    });

    test('en: separador "," e ponto decimal', () => {
        const rows = parse(cutPlanCsv(PLAN, format('.')), ',');

        expect(rows[2][3]).toBe('600.0');
        expect(rows[1][6]).toBe('driver Ø 285.0 mm + port Ø 100.0 mm');
    });

    test('ida e volta: uma linha por peça com os valores da tabela', () => {
        const rows = parse(cutPlanCsv(PLAN, format(',')), ';');
        const pieces = rows.slice(1, 1 + PLAN.pieces.length);

        expect(pieces.map((row) => row[0])).toEqual(['Frente', 'Lateral']);
        expect(pieces[0].slice(2, 6)).toEqual(['1', '636,0', '436,0', '18,0']);
        expect(pieces[0][6]).toBe('driver Ø 285,0 mm + port Ø 100,0 mm');
    });

    test('bloco de dimensões e bloco de conferência', () => {
        const rows = parse(cutPlanCsv(PLAN, format(',')), ';');
        const at = rows.findIndex((row) => row[0] === 'Dimensões');

        expect(rows[at]).toEqual([
            'Dimensões',
            'Largura (mm)',
            'Altura (mm)',
            'Profundidade (mm)',
        ]);
        expect(rows[at + 1]).toEqual(['Internas', '400,0', '600,0', '250,0']);
        expect(rows[at + 2]).toEqual(['Externas', '436,0', '636,0', '286,0']);

        const check = rows.findIndex(
            (row) => row[0] === 'Conferência de volume',
        );

        expect(rows[check][1]).toBe('Interno (L)');
        expect(rows[check + 1]).toEqual([
            'Caixa',
            '63,0',
            '3,0',
            '2,0',
            '1,0',
            '57,0',
            '57,0',
            '0,00 %',
        ]);
    });

    test('bandpass lista as profundidades das câmaras e as duas linhas da conferência', () => {
        const bandpass: Plan = {
            ...PLAN,
            boxType: 'bandpass',
            dimensions: {
                ...PLAN.dimensions,
                chambers: { rear_d_m: 0.1, front_d_m: 0.15 },
            },
            volume: {
                chambers: [
                    { ...PLAN.volume.chambers[0], id: 'rear' },
                    { ...PLAN.volume.chambers[0], id: 'front' },
                ],
            },
        };
        const rows = parse(cutPlanCsv(bandpass, format(',')), ';');

        expect(
            rows.find((row) =>
                row[0].startsWith('Profundidade da câmara traseira'),
            ),
        ).toEqual(['Profundidade da câmara traseira (mm)', '100,0']);
        expect(rows.filter((row) => row[0] === 'Câmara frontal')).toHaveLength(
            1,
        );
    });

    test('campos com separador, aspas ou quebra de linha vão entre aspas', () => {
        const nasty = format(',');
        nasty.cutouts = () => ['a;b', 'dito "x"', 'linha\nnova'];
        const csv = cutPlanCsv(PLAN, nasty);

        expect(csv).toContain('"a;b + dito ""x"" + linha\nnova"');
        expect(parse(csv, ';')[1][6]).toBe('a;b + dito "x" + linha\nnova');
    });

    test('sem conferência de simulação os campos ficam vazios', () => {
        const open: Plan = {
            ...PLAN,
            volume: {
                chambers: [
                    {
                        ...PLAN.volume.chambers[0],
                        simulated_m3: undefined,
                        difference_ratio: undefined,
                    },
                ],
            },
        };
        const rows = parse(cutPlanCsv(open, format(',')), ';');
        const check = rows.findIndex((row) => row[0] === 'Caixa');

        expect(rows[check].slice(-2)).toEqual(['', '']);
    });

    test('é determinístico', () => {
        expect(cutPlanCsv(PLAN, format(','))).toBe(
            cutPlanCsv(PLAN, format(',')),
        );
    });
});
