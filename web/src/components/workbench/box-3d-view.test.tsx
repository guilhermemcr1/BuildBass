import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Plan } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { Box3dView } from './box-3d-view';

const BASE: Plan = {
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
            cutouts: [],
        },
    ],
    volume: { chambers: [] },
    warnings: [],
};

const WITH_DRIVER: Plan = {
    ...BASE,
    pieces: [
        {
            ...BASE.pieces[0],
            cutouts: [
                {
                    kind: 'driver',
                    shape: 'round',
                    diameter_m: 0.2,
                    center: { x_m: 0.218, y_m: 0.318 },
                },
            ],
        },
    ],
};

const BANDPASS: Plan = {
    ...BASE,
    boxType: 'bandpass',
    dimensions: {
        ...BASE.dimensions,
        chambers: { rear_d_m: 0.1, front_d_m: 0.15 },
    },
};

function view() {
    const svg = screen.getByRole('img');

    return {
        svg,
        yaw: Number(svg.getAttribute('data-yaw')),
        pitch: Number(svg.getAttribute('data-pitch')),
        zoom: Number(svg.getAttribute('data-zoom')),
    };
}

describe('Box3dView', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('resume tipo e medidas externas no nome da imagem e é focável', () => {
        renderWithProviders(<Box3dView plan={BASE} />);

        expect(view().svg).toHaveAccessibleName(
            /dutada.*436,0 mm de largura.*636,0 mm de altura.*286,0 mm de profundidade/,
        );
        expect(view().svg).toHaveAttribute('tabindex', '0');
    });

    test('as setas giram, + e − mudam o zoom e Home reinicia', async () => {
        renderWithProviders(<Box3dView plan={BASE} />);
        const start = view();

        view().svg.focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(view().yaw).toBeGreaterThan(start.yaw);

        await userEvent.keyboard('{ArrowUp}');
        expect(view().pitch).toBeGreaterThan(start.pitch);

        await userEvent.keyboard('+');
        expect(view().zoom).toBeGreaterThan(start.zoom);

        await userEvent.keyboard('-{-}');
        expect(view().zoom).toBeLessThan(start.zoom);

        await userEvent.keyboard('{Home}');
        expect(view()).toMatchObject({
            yaw: start.yaw,
            pitch: start.pitch,
            zoom: start.zoom,
        });
    });

    test('os botões fazem o mesmo que o teclado', async () => {
        renderWithProviders(<Box3dView plan={BASE} />);
        const start = view();

        await userEvent.click(
            screen.getByRole('button', { name: 'Girar para a esquerda' }),
        );
        expect(view().yaw).toBeLessThan(start.yaw);

        await userEvent.click(
            screen.getByRole('button', { name: 'Girar para baixo' }),
        );
        expect(view().pitch).toBeLessThan(start.pitch);

        await userEvent.click(
            screen.getByRole('button', { name: 'Aproximar' }),
        );
        expect(view().zoom).toBeGreaterThan(start.zoom);

        await userEvent.click(
            screen.getByRole('button', { name: 'Reiniciar' }),
        );
        expect(view()).toMatchObject({
            yaw: start.yaw,
            pitch: start.pitch,
            zoom: start.zoom,
        });
    });

    test('a inclinação e o zoom têm limites', async () => {
        renderWithProviders(<Box3dView plan={BASE} />);
        view().svg.focus();

        for (let index = 0; index < 40; index += 1) {
            await userEvent.keyboard('{ArrowUp}+');
        }

        expect(view().pitch).toBeLessThan(Math.PI / 2);
        expect(view().zoom).toBeLessThanOrEqual(4);
    });

    test('"Ver por dentro" mostra a divisória da bandpass', async () => {
        const { container } = renderWithProviders(
            <Box3dView plan={BANDPASS} />,
        );

        expect(container.querySelector('[data-id="divider"]')).toBeNull();

        await userEvent.click(
            screen.getByRole('switch', { name: 'Ver por dentro' }),
        );

        expect(container.querySelector('[data-id="divider"]')).not.toBeNull();
        expect(
            screen.getByRole('switch', { name: 'Ver por dentro' }),
        ).toBeChecked();
    });

    test('as três cotas aparecem com a medida externa na unidade ativa', () => {
        const { container } = renderWithProviders(<Box3dView plan={BASE} />);
        const lines = container.querySelectorAll('[data-dimension]');

        expect(
            [...lines].map((line) => line.getAttribute('data-dimension')),
        ).toEqual(['width', 'height', 'depth']);
        expect(
            container.querySelector('[data-dimension="width"] text'),
        ).toHaveTextContent('436,0 mm');
        expect(
            container.querySelector('[data-dimension="height"] text'),
        ).toHaveTextContent('636,0 mm');
        expect(
            container.querySelector('[data-dimension="depth"] text'),
        ).toHaveTextContent('286,0 mm');
    });

    test('no sistema imperial as cotas usam polegadas', () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        const { container } = renderWithProviders(<Box3dView plan={BASE} />);

        expect(
            container.querySelector('[data-dimension="width"] text'),
        ).toHaveTextContent(/in/);
    });

    test('as cotas acompanham a vista ao girar', async () => {
        const { container } = renderWithProviders(<Box3dView plan={BASE} />);
        const before = container
            .querySelector('[data-dimension="width"] line')
            ?.getAttribute('x1');

        view().svg.focus();
        await userEvent.keyboard('{ArrowRight}');

        expect(
            container
                .querySelector('[data-dimension="width"] line')
                ?.getAttribute('x1'),
        ).not.toBe(before);
    });

    test('o alto-falante é desenhado com aro, suspensão, cone e capa, sem texto', () => {
        const { container } = renderWithProviders(
            <Box3dView plan={WITH_DRIVER} />,
        );
        const layers = [...container.querySelectorAll('[data-part="driver"]')];

        // A vista padrão olha de cima e de lado: a frente aparece e o alto-falante vem junto.
        expect(layers).toHaveLength(4);
        expect(
            container.querySelector('[data-layer="flange"]'),
        ).not.toBeNull();
        expect(container.querySelector('[data-layer="cone"]')).not.toBeNull();
        expect(container.querySelector('[data-layer="cap"]')).toHaveClass(
            'fill-accent',
        );
        expect(container.querySelector('svg text')?.textContent).not.toBe(
            'Alto-falante',
        );
        expect(view().svg).toHaveAccessibleName(/Alto-falante na frente\./);
    });

    test('sem medida do recorte não há polígono do driver inventado', () => {
        const { container } = renderWithProviders(
            <Box3dView
                plan={{
                    ...BASE,
                    pieces: [
                        {
                            ...BASE.pieces[0],
                            cutouts: [
                                {
                                    kind: 'driver',
                                    shape: 'round',
                                    pending: ['cutout_m'],
                                },
                            ],
                        },
                    ],
                }}
            />,
        );

        expect(container.querySelector('[data-part="driver"]')).toBeNull();
        expect(view().svg).not.toHaveAccessibleName(/Alto-falante na frente/);
    });
});
