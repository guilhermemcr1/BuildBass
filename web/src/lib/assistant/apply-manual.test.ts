import { describe, expect, test } from 'vite-plus/test';
import { createProjectData } from '@/lib/project/types';
import { applyManualToProject, withoutDriver } from './apply-manual';

describe('applyManualToProject', () => {
    test('preenche só o que está vazio, com identidade e diâmetro', () => {
        const data = {
            ...createProjectData('Teste'),
            driver: { fs_hz: 30 },
            driverSource: { brand: 'Minha' },
        };

        const result = applyManualToProject(data, {
            brand: 'Outra',
            model: 'X12',
            type: 'subwoofer',
            numbers: {
                fs_hz: 40,
                qts: 0.4,
                vas_m3: 0.05,
                nominal_diameter_m: 0.3,
            },
        });

        expect(result.data.driver).toEqual({
            fs_hz: 30,
            qts: 0.4,
            vas_m3: 0.05,
        });
        expect(result.data.driverSource).toEqual({
            brand: 'Minha',
            model: 'X12',
            type: 'subwoofer',
        });
        expect(result.data.driverDims?.a_m).toBe(0.3);
        expect(result.filled).toEqual(['qts', 'vas_m3', 'nominal_diameter_m']);
    });

    test('não mexe na cota A já informada', () => {
        const data = {
            ...createProjectData('Teste'),
            driverDims: { a_m: 0.31 },
        };

        const result = applyManualToProject(data, {
            numbers: { nominal_diameter_m: 0.25 },
        });

        expect(result.data.driverDims?.a_m).toBe(0.31);
        expect(result.filled).toEqual([]);
    });

    test('sobre um projeto limpo, o manual substitui o alto-falante anterior por inteiro', () => {
        const data = {
            ...createProjectData('Teste'),
            driver: { fs_hz: 30, qts: 0.7, re_ohm: 3.2, xmax_m: 0.01 },
            driverSource: { brand: 'Antiga', model: 'A1', variant: '4 Ω' },
            driverDims: { a_m: 0.25 },
        };

        const result = applyManualToProject(withoutDriver(data), {
            brand: 'Nova',
            model: 'N12',
            numbers: { fs_hz: 40, qts: 0.4, vas_m3: 0.05 },
        });

        // Nada do anterior sobra: nem Re/Xmax que o manual novo não trouxe, nem variante, nem cota A.
        expect(result.data.driver).toEqual({
            fs_hz: 40,
            qts: 0.4,
            vas_m3: 0.05,
        });
        expect(result.data.driverSource).toEqual({
            brand: 'Nova',
            model: 'N12',
        });
        expect(result.data.driverDims?.a_m).toBeUndefined();
        expect(result.filled).toEqual(['fs_hz', 'qts', 'vas_m3']);
    });
});
