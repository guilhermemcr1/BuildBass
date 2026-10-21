import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriverOrigin } from './driver-origin';

beforeEach(() => {
    localStorage.clear();
    useWorkspace.setState(initialWorkspace());
});

describe('DriverOrigin', () => {
    test('sem origem não renderiza texto', () => {
        renderWithProviders(<DriverOrigin />);

        expect(screen.queryByText(/Origem/)).not.toBeInTheDocument();
    });

    test('mostra fabricante, modelo e variação numa região viva', () => {
        renderWithProviders(<DriverOrigin />);

        act(() => {
            activeProjectStore()
                .getState()
                .applyCatalogDriver(
                    { fs_hz: 76 },
                    { brand: 'Triton', model: 'TR 620 12"', variant: '4 Ω' },
                );
        });

        const region = screen.getByText(/Origem/).closest('[aria-live]');
        expect(region).toHaveAttribute('aria-live', 'polite');
        expect(region).toHaveTextContent('Origem: Triton TR 620 12" (4 Ω)');
    });

    test('sem variação não mostra parênteses', () => {
        renderWithProviders(<DriverOrigin />);

        act(() => {
            activeProjectStore()
                .getState()
                .applyCatalogDriver(
                    { fs_hz: 76 },
                    { brand: 'Triton', model: 'TR 620' },
                );
        });

        expect(
            screen.getByText(/Origem/).closest('[aria-live]'),
        ).toHaveTextContent(/^Origem: Triton TR 620$/);
    });

    test('trocar de aba troca a origem exibida', () => {
        renderWithProviders(<DriverOrigin />);
        act(() => {
            activeProjectStore()
                .getState()
                .applyCatalogDriver(
                    { fs_hz: 76 },
                    { brand: 'Triton', model: 'A' },
                );
            useWorkspace.getState().newProject();
        });

        expect(screen.queryByText(/Triton/)).not.toBeInTheDocument();
    });
});
