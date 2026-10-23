import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { downloadBlob } from '@/lib/chart-export/download';
import { exportChart } from '@/lib/chart-export';
import { makeInput } from '@/lib/chart-export/test-input';
import { CHART_EXPORT_KEY, useChartExport } from '@/stores/chart-export';
import { renderWithProviders } from '@/test/render';
import ChartExportDialog from './chart-export-dialog';

// O PNG precisa de canvas, que o jsdom não tem; a cena e o SVG são reais.
vi.mock('@/lib/chart-export', async (original) => ({
    ...(await original<typeof import('@/lib/chart-export')>()),
    exportChart: vi.fn(),
}));
vi.mock('@/lib/chart-export/download', () => ({ downloadBlob: vi.fn() }));

const DEFAULTS = {
    format: 'png' as const,
    groups: { peak: true, cutoffs: true, box: true, limits: true },
};

function previewSvg(): string {
    const src = screen.getByRole('img').getAttribute('src') ?? '';

    return decodeURIComponent(src.slice(src.indexOf(',') + 1));
}

function renderDialog(
    input = makeInput(),
    onOpenChange: (open: boolean) => void = () => {},
) {
    return renderWithProviders(
        <ChartExportDialog open onOpenChange={onOpenChange} input={input} />,
    );
}

beforeEach(() => {
    window.localStorage.removeItem(CHART_EXPORT_KEY);
    useChartExport.setState(DEFAULTS);
    vi.mocked(exportChart).mockReset();
    vi.mocked(downloadBlob).mockReset();
});

describe('ChartExportDialog', () => {
    test('abre com título, formato, grupos e a prévia do gráfico', () => {
        renderDialog();

        expect(
            screen.getByRole('heading', { name: 'Exportar gráfico' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'PNG' })).toBeChecked();
        expect(
            screen
                .getAllByRole('checkbox')
                .map((box) => box.closest('label')?.textContent),
        ).toEqual([
            'Pico por série',
            'F-3 / F-10',
            'Parâmetros da caixa',
            'Limites e alertas',
        ]);

        const preview = screen.getByRole('img');

        expect(preview).toHaveAttribute('alt', 'Prévia de Resposta: Projeto a');
        expect(preview.getAttribute('src')).toMatch(
            /^data:image\/svg\+xml;charset=utf-8,/,
        );
        expect(previewSvg()).toContain('<svg');
    });

    test('baixar gera o arquivo, entrega ao navegador e fecha', async () => {
        const blob = new Blob(['x']);
        vi.mocked(exportChart).mockResolvedValue({
            blob,
            fileName: 'projeto-a-response-2026-10-23.png',
        });
        const onOpenChange = vi.fn();
        renderDialog(makeInput(), onOpenChange);

        await userEvent.click(screen.getByRole('button', { name: 'Baixar' }));

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
        expect(downloadBlob).toHaveBeenCalledWith(
            blob,
            'projeto-a-response-2026-10-23.png',
        );
        // Na aba Resposta não há limite: o grupo sai desligado mesmo ligado na preferência.
        expect(vi.mocked(exportChart).mock.calls[0][1]).toEqual({
            format: 'png',
            groups: { ...DEFAULTS.groups, limits: false },
        });
    });

    test('falha mostra o aviso, mantém o diálogo e as opções, e dá para tentar de novo', async () => {
        vi.mocked(exportChart).mockRejectedValueOnce(new Error('canvas'));
        vi.mocked(exportChart).mockResolvedValueOnce({
            blob: new Blob(['x']),
            fileName: 'a.png',
        });
        const onOpenChange = vi.fn();
        renderDialog(makeInput(), onOpenChange);

        await userEvent.click(
            screen.getByRole('checkbox', { name: 'Parâmetros da caixa' }),
        );
        await userEvent.click(screen.getByRole('button', { name: 'Baixar' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Não foi possível gerar o arquivo. Tente de novo.',
        );
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(
            screen.getByRole('checkbox', { name: 'Parâmetros da caixa' }),
        ).not.toBeChecked();

        await userEvent.click(screen.getByRole('button', { name: 'Baixar' }));

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('enquanto gera o botão fica desabilitado', async () => {
        let finish: (value: {
            blob: Blob;
            fileName: string;
        }) => void = () => {};
        vi.mocked(exportChart).mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        renderDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Baixar' }));

        expect(screen.getByRole('button', { name: 'Gerando…' })).toBeDisabled();

        finish({ blob: new Blob(['x']), fileName: 'a.png' });
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: 'Baixar' }),
            ).toBeEnabled(),
        );
    });

    test('Esc fecha o diálogo', async () => {
        const onOpenChange = vi.fn();
        renderDialog(makeInput(), onOpenChange);

        await userEvent.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

describe('ChartExportDialog — legenda', () => {
    test('marcar e desmarcar um grupo atualiza a prévia e a preferência', async () => {
        renderDialog();

        expect(previewSvg()).toContain('Pico ');

        await userEvent.click(
            screen.getByRole('checkbox', { name: 'Pico por série' }),
        );

        expect(previewSvg()).not.toContain('Pico ');
        expect(useChartExport.getState().groups.peak).toBe(false);

        await userEvent.click(
            screen.getByRole('checkbox', { name: 'Pico por série' }),
        );

        expect(previewSvg()).toContain('Pico ');
        expect(useChartExport.getState().groups.peak).toBe(true);
    });

    test('desligar todos deixa só o gráfico e a lista de projetos', async () => {
        renderDialog();

        for (const name of [
            'Pico por série',
            'F-3 / F-10',
            'Parâmetros da caixa',
        ]) {
            await userEvent.click(screen.getByRole('checkbox', { name }));
        }

        const svg = previewSvg();

        expect(svg).toContain('Projeto a');
        expect(svg).not.toMatch(/Pico |F-3|Dutada|Fabricante/);
    });

    test('grupo que não se aplica à aba fica desabilitado com a razão em texto', () => {
        renderDialog(makeInput({ kind: 'impedance', title: 'Impedância' }));

        const cutoffs = screen.getByRole('checkbox', { name: 'F-3 / F-10' });
        const limits = screen.getByRole('checkbox', {
            name: 'Limites e alertas',
        });

        expect(cutoffs).toBeDisabled();
        expect(cutoffs).not.toBeChecked();
        expect(limits).toBeDisabled();
        expect(
            screen.getByText('Só vale no gráfico de Resposta.'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Este gráfico não tem limites.'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('checkbox', { name: 'Pico por série' }),
        ).toBeEnabled();
    });

    test('abre com as opções que a pessoa deixou da vez anterior', () => {
        useChartExport.setState({
            format: 'pdf',
            groups: { peak: false, cutoffs: true, box: false, limits: true },
        });
        renderDialog();

        expect(screen.getByRole('radio', { name: 'PDF' })).toBeChecked();
        expect(
            screen.getByRole('checkbox', { name: 'Pico por série' }),
        ).not.toBeChecked();
        expect(
            screen.getByRole('checkbox', { name: 'F-3 / F-10' }),
        ).toBeChecked();
    });
});

describe('ChartExportDialog — formato', () => {
    test('escolher PDF grava a preferência e vai para a exportação', async () => {
        vi.mocked(exportChart).mockResolvedValue({
            blob: new Blob(['x']),
            fileName: 'a.pdf',
        });
        renderDialog();

        await userEvent.click(screen.getByRole('radio', { name: 'PDF' }));

        expect(useChartExport.getState().format).toBe('pdf');

        await userEvent.click(screen.getByRole('button', { name: 'Baixar' }));

        await waitFor(() => expect(exportChart).toHaveBeenCalled());
        expect(vi.mocked(exportChart).mock.calls[0][1].format).toBe('pdf');
    });
});
