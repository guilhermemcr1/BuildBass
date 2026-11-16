import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { EngineWarnings } from './engine-warnings';

function bandpass(
    box: Record<string, unknown>,
    driver: Record<string, number>,
) {
    act(() => {
        const project = activeProjectStore().getState();

        for (const [key, value] of Object.entries(driver)) {
            project.setDriverValue(key as 'fs_hz', value);
        }

        project.apply((data) => ({
            ...data,
            box: {
                ...data.box,
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.06,
                fb_hz: 45,
                ...box,
            },
        }));
    });
}

const DRIVER = { fs_hz: 28, qts: 0.38, vas_m3: 0.085 };

describe('EngineWarnings — bandpass', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('câmara traseira ocupada pelos drivers fala da câmara traseira', () => {
        bandpass({ vr_m3: 0.001 }, { ...DRIVER, vd_m3: 0.002 });
        renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(/maior que a câmara traseira/),
        ).toBeInTheDocument();
    });

    test('duto que não cabe, curto e longo falam da câmara frontal', () => {
        bandpass(
            {
                vf_m3: 0.0005,
                fb_hz: 30,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            },
            DRIVER,
        );
        const { unmount } = renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(/não cabe na câmara frontal/),
        ).toBeInTheDocument();
        unmount();

        bandpass(
            {
                vf_m3: 0.06,
                fb_hz: 200,
                port: { shape: 'round', diameter_m: 0.02, count: 1 },
            },
            DRIVER,
        );
        renderWithProviders(<EngineWarnings />);

        expect(screen.getByText(/câmara frontal/)).toBeInTheDocument();
        expect(screen.queryByText(/na caixa/)).toBeNull();
    });

    test('na dutada o texto continua falando da caixa', () => {
        act(() => {
            const project = activeProjectStore().getState();
            project.setDriverValue('fs_hz', 28);
            project.setDriverValue('qts', 0.38);
            project.setDriverValue('vas_m3', 0.085);
            project.apply((data) => ({
                ...data,
                box: {
                    ...data.box,
                    type: 'vented',
                    vb_m3: 0.0005,
                    fb_hz: 30,
                    port: { shape: 'round', diameter_m: 0.1, count: 1 },
                },
            }));
        });
        renderWithProviders(<EngineWarnings />);

        expect(screen.getByText(/não cabe na caixa/)).toBeInTheDocument();
    });
});

function sixth(box: Record<string, unknown>, driver: Record<string, number>) {
    act(() => {
        const project = activeProjectStore().getState();

        for (const [key, value] of Object.entries(driver)) {
            project.setDriverValue(key as 'fs_hz', value);
        }

        project.apply((data) => ({
            ...data,
            box: {
                ...data.box,
                type: 'bandpass6',
                vr_m3: 0.08,
                vf_m3: 0.04,
                fb_hz: 45,
                fb_rear_hz: 30,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
                port_rear: { shape: 'round', diameter_m: 0.1, count: 1 },
                ...box,
            },
        }));
    });
}

const round = (diameter_m: number) => ({
    shape: 'round',
    diameter_m,
    count: 1,
});

describe('EngineWarnings — bandpass de 6ª ordem', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('drivers e duto que não cabem na câmara traseira nomeiam a câmara traseira', () => {
        sixth({ vr_m3: 0.001 }, { ...DRIVER, vd_m3: 0.002 });
        renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(/maior que a câmara traseira/),
        ).toBeInTheDocument();
    });

    test('duto que não cabe: o texto é da câmara do duto', () => {
        sixth({ vr_m3: 0.002, fb_rear_hz: 30, port_rear: round(0.1) }, DRIVER);
        const { unmount } = renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(/não cabe na câmara traseira/),
        ).toBeInTheDocument();
        expect(screen.queryByText(/câmara frontal/)).toBeNull();
        unmount();

        sixth({ vf_m3: 0.002, fb_hz: 30, port: round(0.1) }, DRIVER);
        renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(/não cabe na câmara frontal/),
        ).toBeInTheDocument();
    });

    test('duto curto demais e longo demais, por câmara', () => {
        sixth({ vr_m3: 0.2, fb_rear_hz: 100, port_rear: round(0.05) }, DRIVER);
        const first = renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(
                /comprimento zero ou negativo para essa câmara traseira/,
            ),
        ).toBeInTheDocument();
        first.unmount();

        sixth({ vf_m3: 0.2, fb_hz: 100, port: round(0.05) }, DRIVER);
        const second = renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(
                /comprimento zero ou negativo para essa câmara frontal/,
            ),
        ).toBeInTheDocument();
        second.unmount();

        sixth({ vr_m3: 0.02, fb_rear_hz: 20, port_rear: round(0.05) }, DRIVER);
        renderWithProviders(<EngineWarnings />);

        expect(
            screen.getByText(
                /O duto da câmara traseira \(.+\) é tão comprido que o próprio tubo ressoa em .+ Hz/,
            ),
        ).toBeInTheDocument();
    });

    test('as duas câmaras com problema mostram os dois avisos', () => {
        sixth(
            {
                vr_m3: 0.2,
                fb_rear_hz: 100,
                port_rear: round(0.05),
                vf_m3: 0.2,
                fb_hz: 100,
                port: round(0.05),
            },
            DRIVER,
        );
        renderWithProviders(<EngineWarnings />);

        expect(
            screen.getAllByText(/comprimento zero ou negativo/),
        ).toHaveLength(2);
    });

    test('em inglês os textos também nomeiam a câmara', () => {
        sixth({ vr_m3: 0.002, fb_rear_hz: 30, port_rear: round(0.1) }, DRIVER);
        renderWithProviders(<EngineWarnings />, 'en');

        expect(
            screen.getByText(/doesn't fit in the rear chamber/),
        ).toBeInTheDocument();
    });
});
