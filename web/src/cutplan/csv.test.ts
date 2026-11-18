import { describe, expect, test } from 'vite-plus/test';
import { cutPlanCsv } from './csv';
import { nestPieces } from './nesting';
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
        portBoard: 'Tábua do duto',
    },
    positions: {
        front: 'Painel da frente',
        back: 'Painel de trás',
        top: 'Face de cima',
        bottom: 'Face de baixo',
        side: 'Lados esquerdo e direito',
        divider: 'Entre as câmaras',
        portBoard: 'Diagonal no canto',
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
    totals: {
        title: 'Corte total',
        gross: 'Medidas internas (sem a espessura)',
        net: 'Peças prontas (com a espessura)',
        difference: 'O que a espessura acrescenta',
        pieces: 'Peças',
        area: 'Área',
        cutLength: 'Corte',
    },
    sheets: {
        title: 'Chapas',
        sheet: 'Chapa',
        piece: 'Peça',
        unit: 'Unidade',
        x: 'x',
        y: 'y',
        length: 'Comprimento',
        width: 'Largura',
        rotated: 'Girada',
        yes: 'sim',
        no: 'não',
        utilization: 'Aproveitamento',
        waste: 'Sobra',
        oversize: 'Não cabe',
        stock: 'Item do estoque',
        unplaced: 'Sem chapa no estoque',
        cut: 'Tipo de corte',
        guillotine: 'Serra (cortes de ponta a ponta)',
        free: 'CNC/tupia (livre)',
    },
    cutouts: {
        title: 'Recortes',
        cutout: 'Recorte',
        size: 'Medida',
        fromLeft: 'Centro da esquerda',
        fromBottom: 'Centro de baixo',
        position: 'Posição',
        manual: 'manual',
        auto: 'automática',
        driver: 'Driver',
        port: 'Duto',
    },
};

function format(decimal: ',' | '.'): CsvFormat {
    const text = (value: number, digits: number) =>
        value.toFixed(digits).replace('.', decimal);

    return {
        number: (m) => text(m * 1000, 1),
        volume: (m3) => text(m3 * 1000, 1),
        percent: (ratio) => `${text(ratio * 100, 2)} %`,
        area: (m2) => text(m2, 3),
        areaSymbol: 'm²',
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

    test('a exportação traz os recortes da peça Fundo (duto traseiro da bandpass de 6ª ordem)', () => {
        const sixth: Plan = {
            ...PLAN,
            boxType: 'bandpass6',
            pieces: [
                ...PLAN.pieces,
                {
                    role: 'back',
                    quantity: 1,
                    w_m: 0.436,
                    h_m: 0.636,
                    thickness_m: 0.018,
                    cutouts: [
                        { kind: 'port', shape: 'round', diameter_m: 0.08 },
                    ],
                },
            ],
        };
        const rows = parse(cutPlanCsv(sixth, format(',')), ';');
        const back = rows.find((row) => row[0] === 'Fundo');

        expect(back?.join(';')).toContain('port Ø 80,0 mm');
    });

    test('é determinístico', () => {
        expect(cutPlanCsv(PLAN, format(','))).toBe(
            cutPlanCsv(PLAN, format(',')),
        );
    });
});

describe('cutPlanCsv — corte total e chapas', () => {
    test('sempre traz o bloco "Corte total" com as duas bases e a diferença', () => {
        const rows = parse(cutPlanCsv(PLAN, format(',')), ';');
        const at = rows.findIndex((row) => row[0] === 'Corte total');

        expect(rows[at]).toEqual([
            'Corte total',
            'Peças',
            'Área (m²)',
            'Corte (mm)',
        ]);
        expect(rows[at + 1][0]).toBe('Medidas internas (sem a espessura)');
        expect(rows[at + 2][0]).toBe('Peças prontas (com a espessura)');
        expect(rows[at + 3][0]).toBe('O que a espessura acrescenta');
        // Peças: 1 frente + 2 laterais = 3 (com desconto).
        expect(rows[at + 2][1]).toBe('3');
    });

    test('sem chapa não há o bloco "Chapas"', () => {
        const rows = parse(cutPlanCsv(PLAN, format(',')), ';');

        expect(rows.some((row) => row[0] === 'Chapas')).toBe(false);
    });

    test('com chapa: uma linha por colocação, aproveitamento e sobra', () => {
        const layout = nestPieces(PLAN.pieces, {
            stock: [{ index: 0, w_m: 2.75, h_m: 1.85 }],
            kerf_m: 0.003,
            rotate: true,
            cut: 'guillotine',
        });
        const rows = parse(cutPlanCsv(PLAN, format(','), layout), ';');
        const at = rows.findIndex((row) => row[0] === 'Chapas');

        expect(rows[at].slice(1)).toEqual([
            'Chapa',
            'Item do estoque',
            'Peça',
            'Unidade',
            'x (mm)',
            'y (mm)',
            'Comprimento (mm)',
            'Largura (mm)',
            'Girada',
        ]);
        const placed = rows.slice(at + 1, at + 4);

        expect(placed.map((row) => row[3]).sort()).toEqual([
            'Frente',
            'Lateral',
            'Lateral',
        ]);
        expect(placed.every((row) => row[1] === '1')).toBe(true);
        expect(placed.every((row) => row[2] === '1')).toBe(true);
        expect(rows.some((row) => row[0] === 'Aproveitamento')).toBe(true);
        expect(rows.some((row) => row[0].startsWith('Sobra'))).toBe(true);
        expect(rows.find((row) => row[0] === 'Tipo de corte')?.[1]).toBe(
            'Serra (cortes de ponta a ponta)',
        );
    });

    test('estoque: cada colocação diz o item de origem, e o que faltou sai como "Sem chapa no estoque"', () => {
        const layout = nestPieces(PLAN.pieces, {
            stock: [
                { index: 0, w_m: 0.3, h_m: 0.3, quantity: 1 },
                { index: 1, w_m: 2.75, h_m: 1.85, quantity: 1 },
            ],
            kerf_m: 0.003,
            rotate: true,
            cut: 'free',
        });
        const rows = parse(cutPlanCsv(PLAN, format(','), layout), ';');
        const at = rows.findIndex((row) => row[0] === 'Chapas');
        const placed = rows
            .slice(at + 1)
            .filter((row) => row[0] === '' && row[1] !== undefined);

        expect(placed.every((row) => row[2] === '2')).toBe(true);
        expect(rows.find((row) => row[0] === 'Tipo de corte')?.[1]).toBe(
            'CNC/tupia (livre)',
        );
    });

    test('peça que não cabe aparece como "Não cabe"', () => {
        const layout = nestPieces(PLAN.pieces, {
            stock: [{ index: 0, w_m: 0.3, h_m: 0.3 }],
            kerf_m: 0.003,
            rotate: true,
            cut: 'guillotine',
        });
        const rows = parse(cutPlanCsv(PLAN, format(','), layout), ';');

        expect(
            rows.filter((row) => row[0] === 'Não cabe').length,
        ).toBeGreaterThan(0);
    });
});

describe('cutPlanCsv — centros dos recortes', () => {
    test('bloco "Recortes" com o centro de cada recorte e se a posição é manual', () => {
        const [front, ...rest] = PLAN.pieces;
        const plan: Plan = {
            ...PLAN,
            pieces: [
                {
                    ...front,
                    cutouts: [
                        {
                            kind: 'driver',
                            shape: 'round',
                            diameter_m: 0.2,
                            center: { x_m: 0.15, y_m: 0.3 },
                            ref: { piece: 'front', kind: 'driver', n: 1 },
                            manual: true,
                        },
                        {
                            kind: 'port',
                            shape: 'round',
                            diameter_m: 0.1,
                            center: { x_m: 0.2, y_m: 0.1 },
                            ref: { piece: 'front', kind: 'port', n: 1 },
                        },
                        {
                            kind: 'driver',
                            shape: 'round',
                            ref: { piece: 'front', kind: 'driver', n: 2 },
                        },
                    ],
                },
                ...rest,
            ],
        };
        const rows = parse(cutPlanCsv(plan, format(',')), ';');
        const start = rows.findIndex((row) => row[0] === 'Recortes');

        expect(rows[start]).toEqual([
            'Recortes',
            'Peça',
            'Recorte',
            'Medida',
            'Centro da esquerda (mm)',
            'Centro de baixo (mm)',
            'Posição',
        ]);
        expect(rows[start + 1]).toEqual([
            '',
            'Frente',
            'Driver 1',
            'driver Ø 200,0 mm',
            '150,0',
            '300,0',
            'manual',
        ]);
        expect(rows[start + 2]).toEqual([
            '',
            'Frente',
            'Duto 1',
            'port Ø 100,0 mm',
            '200,0',
            '100,0',
            'automática',
        ]);
        expect(rows[start + 3]).toEqual(['']);
    });

    test('sem recorte posicionado não há o bloco', () => {
        const rows = parse(cutPlanCsv(PLAN, format(',')), ';');

        expect(rows.some((row) => row[0] === 'Recortes')).toBe(false);
    });
});
