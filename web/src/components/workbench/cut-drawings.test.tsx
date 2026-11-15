import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Plan } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { CutDrawings } from './cut-drawings';

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
                {
                    kind: 'driver',
                    shape: 'round',
                    diameter_m: 0.285,
                    center: { x_m: 0.218, y_m: 0.4 },
                },
                {
                    kind: 'port',
                    shape: 'rect',
                    width_m: 0.1,
                    height_m: 0.05,
                    center: { x_m: 0.218, y_m: 0.1 },
                },
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
    volume: { chambers: [] },
    warnings: [],
};

describe('CutDrawings', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('um desenho por peça, com título do nome e descrição em texto', () => {
        renderWithProviders(<CutDrawings plan={PLAN} />);

        const front = screen.getByRole('img', { name: 'Frente' });
        const side = screen.getByRole('img', { name: 'Lateral ×2' });

        expect(screen.getAllByRole('img')).toHaveLength(2);
        expect(front).toHaveAccessibleDescription(
            /Frente: 436,0 mm por 636,0 mm, espessura 18,0 mm\. Recortes: Driver Ø 285,0 mm; Duto 100,0 mm × 50,0 mm\./,
        );
        expect(side).toHaveAccessibleDescription(/Recortes: nenhum\./);
    });

    test('as cotas são as da tabela de peças, na unidade ativa', () => {
        renderWithProviders(<CutDrawings plan={PLAN} />);

        const front = screen.getByRole('img', { name: 'Frente' });

        expect(within(front).getByText('436,0 mm')).toBeInTheDocument();
        expect(within(front).getByText('636,0 mm')).toBeInTheDocument();
        expect(within(front).getByText('Ø 285,0 mm')).toBeInTheDocument();
    });

    test('no sistema imperial as cotas saem em polegadas', () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        renderWithProviders(<CutDrawings plan={PLAN} />);

        const front = screen.getByRole('img', { name: 'Frente' });

        expect(within(front).getByText('17,165 in')).toBeInTheDocument();
        expect(within(front).getByText('25,039 in')).toBeInTheDocument();
    });

    test('recorte sem medida é tracejado e rotulado "diâmetro a informar"', () => {
        const pending: Plan = {
            ...PLAN,
            pieces: [
                {
                    ...PLAN.pieces[0],
                    cutouts: [
                        {
                            kind: 'driver',
                            shape: 'round',
                            pending: ['cutout_m'],
                        },
                    ],
                },
                PLAN.pieces[1],
            ],
        };
        const { container } = renderWithProviders(
            <CutDrawings plan={pending} />,
        );

        expect(
            within(screen.getByRole('img', { name: 'Frente' })).getByText(
                'diâmetro a informar',
            ),
        ).toBeInTheDocument();
        expect(
            container.querySelector('circle[stroke-dasharray]'),
        ).not.toBeNull();
    });

    test('todos os desenhos usam a mesma escala', () => {
        const { container } = renderWithProviders(<CutDrawings plan={PLAN} />);
        const figures = [...container.querySelectorAll('figure')];
        const svgs = [...container.querySelectorAll('figure > svg')];
        const widthRem = figures.map((figure) =>
            Number.parseFloat((figure as HTMLElement).style.width),
        );
        const viewBoxWidth = svgs.map((svg) =>
            Number(svg.getAttribute('viewBox')?.split(' ')[2]),
        );

        // Largura na tela / largura no desenho (unidades do viewBox) é a mesma em todos.
        const ratios = widthRem.map((p, index) => p / viewBoxWidth[index]);

        expect(ratios[0]).toBeCloseTo(ratios[1], 9);
        // A escala é em rem: o maior desenho nunca passa de 22rem, qualquer que seja o painel.
        expect(Math.max(...widthRem)).toBeLessThanOrEqual(22);
    });
});

describe('CutDrawings — posição dos recortes (feature 012)', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('só peças com recorte posicionado ganham o botão "Posicionar recortes"', () => {
        renderWithProviders(<CutDrawings plan={PLAN} />);

        expect(
            screen.getByRole('button', {
                name: 'Posicionar recortes de frente',
            }),
        ).toBeVisible();
        expect(
            screen.getAllByRole('button', { name: /Posicionar recortes/ }),
        ).toHaveLength(1);
    });

    test('recorte com posição manual leva a marca no desenho', () => {
        const [front, ...rest] = PLAN.pieces;
        const { container } = renderWithProviders(
            <CutDrawings
                plan={{
                    ...PLAN,
                    pieces: [
                        {
                            ...front,
                            cutouts: [
                                {
                                    ...front.cutouts[0],
                                    manual: true,
                                    ref: {
                                        piece: 'front',
                                        kind: 'driver',
                                        n: 1,
                                    },
                                },
                                front.cutouts[1],
                            ],
                        },
                        ...rest,
                    ],
                }}
            />,
        );

        expect(container.querySelectorAll('[data-manual="true"]')).toHaveLength(
            1,
        );
        expect(container.querySelector('[data-centers]')).toHaveTextContent(
            'Driver 1: centro a 218,0 mm da esquerda e 400,0 mm de baixo (posição manual)',
        );
        expect(
            container.querySelector('[data-manual="true"] path'),
        ).not.toBeNull();
    });
});
