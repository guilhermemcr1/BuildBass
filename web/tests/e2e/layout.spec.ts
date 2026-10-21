import { expect, test } from '@playwright/test';

const REGIONS = ['driver', 'box', 'charts', 'results'] as const;

test('a 1440 px as quatro regiões aparecem sem rolar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    for (const region of REGIONS) {
        await expect(
            page.locator(`[data-region="${region}"]`),
        ).toBeInViewport();
    }
});

for (const width of [360, 768, 1024, 1280, 1440, 2560]) {
    test(`sem rolagem horizontal a ${width} px (SC-008)`, async ({ page }) => {
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

test('a 360 px as regiões empilham na ordem driver → caixa → gráficos → resultados', async ({
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

test('a 360 px a bandpass completa não rola na horizontal (feature 004, US5)', async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Bandpass' }).click();

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

test('a 360 px o plano de corte não rola na horizontal (feature 005, US7)', async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Bandpass' }).click();

    for (const [name, value] of [
        [/^Vr/, '40'],
        [/^Vf/, '60'],
        [/^Fb/, '45'],
    ] as const) {
        const field = page.getByRole('textbox', { name });
        await field.fill(value);
        await field.press('Tab');
    }

    await page.getByRole('radio', { name: 'Plano de corte' }).click();
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

    // As tabelas rolam dentro do próprio contêiner, não a página.
    await page.getByRole('tab', { name: 'Vista 3D' }).click();
    await expect(
        page.locator('[data-region="plan"] svg[data-yaw]'),
    ).toBeVisible();
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        ),
    ).toBeLessThanOrEqual(0);
});
