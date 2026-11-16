import { expect, test } from '@playwright/test';

const REGIONS = ['driver', 'box', 'results', 'charts'] as const;

test('a 1440 px driver, gráficos e resultados aparecem sem rolar e a caixa fica logo abaixo do driver', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    for (const region of ['driver', 'charts', 'results'] as const) {
        await expect(
            page.locator(`[data-region="${region}"]`),
        ).toBeInViewport();
    }

    const driver = await page.locator('[data-region="driver"]').boundingBox();
    const box = await page.locator('[data-region="box"]').boundingBox();

    expect(driver).not.toBeNull();
    expect(box).not.toBeNull();
    expect(box!.x).toBe(driver!.x);
    expect(box!.y).toBeGreaterThanOrEqual(driver!.y + driver!.height);
    expect(box!.y - (driver!.y + driver!.height)).toBeLessThanOrEqual(24);
});

for (const width of [360, 768, 1024, 1280, 1440, 2560]) {
    test(`sem rolagem horizontal a ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        await page.locator('[data-region="driver"]').waitFor();

        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        );

        expect(overflow).toBeLessThanOrEqual(0);
    });
}

test('a 360 px as regiões empilham na ordem driver → caixa → resultados → gráficos', async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    const tops: number[] = [];

    for (const region of REGIONS) {
        const box = await page
            .locator(`[data-region="${region}"]`)
            .boundingBox();
        tops.push(box?.y ?? Number.NaN);
    }

    expect(tops).toEqual([...tops].sort((a, b) => a - b));
});

test('a 360 px a bandpass completa não rola na horizontal', async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();

    for (const [name, value] of [
        [/^Vr/, '40'],
        [/^Vf/, '60'],
        [/^Fb/, '45'],
    ] as const) {
        const field = page.getByRole('textbox', { name });
        await field.fill(value);
        await field.press('Tab');
    }

    await expect(page.getByText('Duto (câmara frontal)')).toBeVisible();

    const overflow = await page.evaluate(
        () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
});

test('a 360 px o plano de corte não rola na horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();

    for (const [name, value] of [
        [/^Vr/, '40'],
        [/^Vf/, '60'],
        [/^Fb/, '45'],
    ] as const) {
        const field = page.getByRole('textbox', { name });
        await field.fill(value);
        await field.press('Tab');
    }

    await page
        .getByRole('button', { name: 'Plano de corte', exact: true })
        .click();
    await expect(
        page.getByRole('table', { name: /Lista de corte/ }),
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'Frente' })).toBeVisible();

    const overflow = await page.evaluate(
        () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);

    // A vista 3D abre no modal da caixa (tela cheia no celular) e a página também não rola.
    await page.getByRole('button', { name: 'Ampliar caixa' }).click();
    await expect(
        page.getByRole('dialog').locator('svg[data-yaw]'),
    ).toBeVisible();
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        ),
    ).toBeLessThanOrEqual(0);
});

// SC-003: o painel do Driver ocupa pelo menos 30 % menos altura que antes da
// feature, medido em 1440 px. A referência é a altura do painel no main antes da 008 (928 px, com
// os 13 campos em cartões). Só o modo Normal é comparado com ela: o Pro passou a incluir o desenho,
// as medidas do alto-falante e a identificação, que não existiam na referência.
const DRIVER_HEIGHT_BEFORE = 928;

test.describe('modo Normal enxuga o painel do Driver (SC-003)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('altura do Driver cai 30 % ou mais', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        const driver = page.locator('[data-region="driver"]');
        await expect(page.getByRole('textbox', { name: /^Fs/ })).toBeVisible();
        // Deixa as animações de entrada terminarem antes de medir.
        await page.waitForTimeout(500);

        const normal = await driver.boundingBox();

        // O input do switch fica escondido sob o desenho dele; o usuário clica no rótulo.
        await page.getByText('Modo Pro').click();
        await expect(page.getByRole('textbox', { name: /^Qes/ })).toBeVisible();
        await page.waitForTimeout(500);
        const pro = await driver.boundingBox();

        expect(normal).not.toBeNull();
        expect(pro).not.toBeNull();
        expect(normal!.height).toBeLessThanOrEqual(DRIVER_HEIGHT_BEFORE * 0.7);
        expect(normal!.height).toBeLessThan(pro!.height);
    });
});
