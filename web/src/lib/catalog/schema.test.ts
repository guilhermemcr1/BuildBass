import { describe, expect, test } from 'vite-plus/test';
import { driverResponseSchema, searchResponseSchema } from './schema';

const DRIVER_ID = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

const SUMMARY = {
    id: DRIVER_ID,
    brand: 'Triton',
    model: 'TR 620 12"',
    variant: '4 Ω',
    fs_hz: 76.94,
    qts: 0.717,
    vas_m3: 0.026348,
};

const DRIVER = {
    ...SUMMARY,
    nominal_diameter_m: 0.3048,
    qes: 0.779,
    qms: 8.978,
    re_ohm: 3,
    le_h: 0.000607,
    xmax_m: 0.00635,
    sd_m2: 0.05309,
    pe_w: 620,
    bl_tm: 10.9,
    mms_kg: 0.06392,
    vd_m3: 0.000333,
    source: 'Triton, ficha técnica TR 620 12", jul/2018',
};

const search = (data: unknown[]) => ({
    data,
    meta: { limit: 20, has_more: false },
});

describe('searchResponseSchema', () => {
    test('aceita uma resposta válida', () => {
        expect(searchResponseSchema.safeParse(search([SUMMARY])).success).toBe(
            true,
        );
    });

    test('aceita variante nula', () => {
        const result = searchResponseSchema.safeParse(
            search([{ ...SUMMARY, variant: null }]),
        );

        expect(result.success).toBe(true);
    });

    test.each(['fs_hz', 'qts', 'vas_m3'])('%s é obrigatório', (key) => {
        const { [key as keyof typeof SUMMARY]: _removed, ...rest } = SUMMARY;

        expect(searchResponseSchema.safeParse(search([rest])).success).toBe(
            false,
        );
    });

    test.each([
        ['fs_hz', 0],
        ['qts', 11],
        ['vas_m3', 0],
    ])('%s fora da faixa reprova', (key, value) => {
        const result = searchResponseSchema.safeParse(
            search([{ ...SUMMARY, [key]: value }]),
        );

        expect(result.success).toBe(false);
    });

    test('limites de texto', () => {
        const long = 'x'.repeat(81);

        for (const patch of [
            { brand: '' },
            { brand: long },
            { model: '' },
            { model: long },
            { variant: 'x'.repeat(41) },
        ]) {
            expect(
                searchResponseSchema.safeParse(
                    search([{ ...SUMMARY, ...patch }]),
                ).success,
            ).toBe(false);
        }
    });

    test('id que não é UUID reprova', () => {
        for (const id of [2, '2', 'abc', '']) {
            expect(
                searchResponseSchema.safeParse(search([{ ...SUMMARY, id }]))
                    .success,
            ).toBe(false);
        }
    });

    test('formato errado reprova', () => {
        expect(searchResponseSchema.safeParse({ data: 'x' }).success).toBe(
            false,
        );
        expect(
            searchResponseSchema.safeParse({ data: [SUMMARY] }).success,
        ).toBe(false);
    });
});

describe('driverResponseSchema', () => {
    test('aceita o driver completo e ignora campo desconhecido', () => {
        const result = driverResponseSchema.safeParse({
            data: { ...DRIVER, extra: 1 },
        });

        expect(result.success).toBe(true);
    });

    test('parâmetros opcionais podem faltar', () => {
        const result = driverResponseSchema.safeParse({
            data: { ...SUMMARY, source: 'ficha' },
        });

        expect(result.success).toBe(true);
    });

    test.each([
        ['nominal_diameter_m', 0.01],
        ['nominal_diameter_m', 2],
        ['sd_m2', 5],
        ['xmax_m', -0.001],
    ])('%s = %s reprova', (key, value) => {
        const result = driverResponseSchema.safeParse({
            data: { ...DRIVER, [key]: value },
        });

        expect(result.success).toBe(false);
    });

    test('source com mais de 255 caracteres reprova', () => {
        const result = driverResponseSchema.safeParse({
            data: { ...DRIVER, source: 'x'.repeat(256) },
        });

        expect(result.success).toBe(false);
    });
});

const IMG = {
    url: 'https://api.exemplo.com/storage/driver-images/4f1c0a52-7b3e-4c1d-9f0a-1a2b3c4d5e6f.webp',
    thumb_url:
        'https://api.exemplo.com/storage/driver-images/4f1c0a52-7b3e-4c1d-9f0a-1a2b3c4d5e6f_thumb.webp',
};

describe('imagens do driver', () => {
    test('o resumo aceita cover_thumb_url http(s) e continua válido sem ela', () => {
        expect(
            searchResponseSchema.safeParse(
                search([{ ...SUMMARY, cover_thumb_url: IMG.thumb_url }]),
            ).success,
        ).toBe(true);
        expect(searchResponseSchema.safeParse(search([SUMMARY])).success).toBe(
            true,
        );
    });

    test('o detalhe aceita até 5 imagens e assume lista vazia quando a chave falta', () => {
        const withFive = driverResponseSchema.safeParse({
            data: { ...DRIVER, images: Array(5).fill(IMG) },
        });
        const without = driverResponseSchema.safeParse({ data: DRIVER });

        expect(withFive.success).toBe(true);
        expect(without.success && without.data.data.images).toEqual([]);
    });

    test('mais de 5 imagens reprova', () => {
        const result = driverResponseSchema.safeParse({
            data: { ...DRIVER, images: Array(6).fill(IMG) },
        });

        expect(result.success).toBe(false);
    });

    test.each([
        'javascript:alert(1)',
        'data:image/webp;base64,AAAA',
        'ftp://exemplo.com/a.webp',
        'não é url',
        '/storage/a.webp',
    ])('URL %s reprova', (url) => {
        expect(
            driverResponseSchema.safeParse({
                data: {
                    ...DRIVER,
                    images: [{ url, thumb_url: IMG.thumb_url }],
                },
            }).success,
        ).toBe(false);
        expect(
            searchResponseSchema.safeParse(
                search([{ ...SUMMARY, cover_thumb_url: url }]),
            ).success,
        ).toBe(false);
    });
});

describe('medidas físicas do driver', () => {
    const DIMS = {
        drv_shape: 'rect',
        drv_piston: 'dome',
        drv_a_m: 0.32,
        drv_b_m: 0.26,
        cutout_m: 0.28,
        drv_d_m: 0.2,
        drv_e_m: 0.06,
        drv_f_m: 0.012,
        drv_g_m: 0.14,
    };

    test('aceita formato, pistão e as cotas dentro da faixa', () => {
        const result = driverResponseSchema.safeParse({
            data: { ...DRIVER, ...DIMS },
        });

        expect(result.success).toBe(true);
    });

    test('são opcionais', () => {
        expect(driverResponseSchema.safeParse({ data: DRIVER }).success).toBe(
            true,
        );
    });

    test.each([
        ['drv_a_m', 5],
        ['cutout_m', 2],
        ['drv_f_m', 0.5],
        ['drv_shape', 'oval'],
        ['drv_piston', 'cone-duplo'],
    ])('recusa %s inválido', (key, value) => {
        const result = driverResponseSchema.safeParse({
            data: { ...DRIVER, [key]: value },
        });

        expect(result.success).toBe(false);
    });
});
