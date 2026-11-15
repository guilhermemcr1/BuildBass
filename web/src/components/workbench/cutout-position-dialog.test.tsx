import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { cutPlanOf } from '@/hooks/use-cut-plan';
import { writeField } from '@/lib/project/fields';
import { useExpanded } from '@/stores/expanded';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import CutoutPositionDialog from './cutout-position-dialog';

function setField(key: Parameters<typeof writeField>[1], si: number) {
    act(() =>
        activeProjectStore()
            .getState()
            .apply((data) => writeField(data, key, si)),
    );
}

const store = () => activeProjectStore();
const positions = () => store().getState().data.cutPlan?.positions;

function front() {
    const plan = cutPlanOf(store().getState().data);

    if (plan.status !== 'ready') {
        throw new Error('plano não ficou pronto');
    }

    const piece = plan.plan.pieces.find(({ role }) => role === 'front');

    if (piece === undefined) {
        throw new Error('sem frente');
    }

    return piece;
}

function renderDialog() {
    return renderWithProviders(
        <CutoutPositionDialog
            piece="front"
            open
            onOpenChange={() => undefined}
        />,
    );
}

describe('CutoutPositionDialog (feature 012, US3)', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
        useExpanded.getState().expandAll();
        setField('vb_m3', 0.06);
        setField('cutout_m', 0.2);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('cada recorte é um botão; o primeiro começa escolhido e os campos mostram o centro dele', () => {
        renderDialog();

        const driver = screen.getByRole('button', {
            name: /^Driver 1, posição automática/,
        });
        const port = screen.getByRole('button', {
            name: /^Duto 1, posição automática/,
        });

        expect(driver).toHaveAttribute('aria-pressed', 'true');
        expect(port).toHaveAttribute('aria-pressed', 'false');

        const center = front().cutouts[0].center;

        expect(
            screen.getByRole('textbox', { name: /Driver 1:.*borda esquerda/ }),
        ).toHaveValue(((center?.x_m ?? 0) * 1000).toFixed(1).replace('.', ','));
    });

    test('digitar o centro grava a posição manual e o recorte passa a ser manual', async () => {
        renderDialog();

        const x = screen.getByRole('textbox', {
            name: /Driver 1:.*borda esquerda/,
        });

        await userEvent.clear(x);
        await userEvent.type(x, '150{Tab}');

        expect(positions()).toEqual([
            {
                piece: 'front',
                kind: 'driver',
                n: 1,
                x_m: 0.15,
                y_m: front().cutouts[0].center?.y_m,
            },
        ]);
        expect(
            screen.getByRole('button', { name: /^Driver 1, posição manual/ }),
        ).toBeVisible();
    });

    test('setas movem 1 mm, Shift 10 mm, e o leitor de tela ouve a posição nova', async () => {
        renderDialog();

        const start = front().cutouts[1].center ?? { x_m: 0, y_m: 0 };
        const port = screen.getByRole('button', { name: /^Duto 1/ });

        act(() => port.focus());
        await userEvent.keyboard('{ArrowRight}');
        await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');

        const [saved] = positions() ?? [];

        expect(saved.kind).toBe('port');
        expect(saved.x_m).toBeCloseTo(start.x_m + 0.001, 9);
        expect(saved.y_m).toBeCloseTo(start.y_m + 0.01, 9);
        expect(screen.getByRole('status')).toHaveTextContent(
            /^Duto 1: .* da esquerda, .* de baixo\.$/,
        );
    });

    test('"Voltar ao automático" e "Todos automáticos" apagam as posições da peça', async () => {
        renderDialog();

        const reset = screen.getByRole('button', {
            name: 'Voltar ao automático',
        });
        const all = screen.getByRole('button', { name: 'Todos automáticos' });

        expect(reset).toBeDisabled();
        expect(all).toBeDisabled();

        act(() => screen.getByRole('button', { name: /^Driver 1/ }).focus());
        await userEvent.keyboard('{ArrowLeft}');
        act(() => screen.getByRole('button', { name: /^Duto 1/ }).focus());
        await userEvent.keyboard('{ArrowLeft}');

        expect(positions()).toHaveLength(2);

        await userEvent.click(
            screen.getByRole('button', { name: 'Voltar ao automático' }),
        );

        expect(positions()?.map(({ kind }) => kind)).toEqual(['driver']);

        await userEvent.click(
            screen.getByRole('button', { name: 'Todos automáticos' }),
        );

        expect(positions()).toBeUndefined();
        expect(screen.getByRole('status')).toHaveTextContent(
            'Todos os recortes da peça voltaram à posição automática.',
        );
    });

    test('arrastar grava uma vez ao soltar, em passos de 1 mm, com o centro preso à peça', () => {
        const { container } = renderDialog();
        const piece = front();
        const svg = container.ownerDocument.querySelector('svg[role="group"]');

        if (!(svg instanceof SVGSVGElement)) {
            throw new Error('sem desenho');
        }

        // A tela tem 1 px por unidade do viewBox (1 mm), começando no canto do viewBox.
        const [vx, vy, vw, vh] = (svg.getAttribute('viewBox') ?? '')
            .split(' ')
            .map(Number);
        svg.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                width: vw,
                height: vh,
                right: vw,
                bottom: vh,
                x: 0,
                y: 0,
            }) as DOMRect;

        const toScreen = (x_m: number, y_m: number) => ({
            clientX: x_m * 1000 - vx,
            clientY: (piece.h_m - y_m) * 1000 - vy,
        });
        const start = piece.cutouts[0].center ?? { x_m: 0, y_m: 0 };
        const handle = container.ownerDocument.querySelector(
            '[data-cutout="driver-1"]',
        );

        if (handle === null) {
            throw new Error('sem recorte');
        }

        // As edições do `beforeEach` acabaram de acontecer: sem o relógio adiante, o Desfazer
        // juntaria o arrasto com elas (grupo de 400 ms).
        const later = Date.now() + 10_000;
        vi.spyOn(Date, 'now').mockReturnValue(later);
        const before = store().temporal.getState().pastStates.length;

        fireEvent.pointerDown(handle, {
            pointerId: 1,
            ...toScreen(start.x_m, start.y_m),
        });
        fireEvent.pointerMove(handle, {
            pointerId: 1,
            ...toScreen(start.x_m + 0.0204, start.y_m - 0.0306),
        });
        fireEvent.pointerMove(handle, {
            pointerId: 1,
            ...toScreen(start.x_m + 0.0504, start.y_m - 0.0306),
        });

        expect(positions()).toBeUndefined();

        fireEvent.pointerUp(handle, { pointerId: 1 });

        const [saved] = positions() ?? [];
        const mm = (value: number) => Math.round(value * 1000) / 1000;

        expect(saved.x_m).toBeCloseTo(mm(start.x_m + 0.0504), 9);
        expect(saved.y_m).toBeCloseTo(mm(start.y_m - 0.0306), 9);
        expect(store().temporal.getState().pastStates.length).toBe(before + 1);

        // Arrastar para fora deixa o centro na borda da peça.
        fireEvent.pointerDown(handle, {
            pointerId: 2,
            ...toScreen(saved.x_m, saved.y_m),
        });
        fireEvent.pointerMove(handle, {
            pointerId: 2,
            ...toScreen(-1, piece.h_m + 1),
        });
        fireEvent.pointerUp(handle, { pointerId: 2 });

        expect(positions()?.[0].x_m).toBe(0);
        expect(positions()?.[0].y_m).toBeCloseTo(mm(piece.h_m), 9);
    });

    test('recorte fora da peça mostra o erro da peça no próprio diálogo', async () => {
        renderDialog();

        const x = screen.getByRole('textbox', {
            name: /Driver 1:.*borda esquerda/,
        });

        await userEvent.clear(x);
        await userEvent.type(x, '20{Tab}');

        expect(
            screen.getByText(/Driver 1 passa da borda de frente/),
        ).toBeVisible();
    });
});
