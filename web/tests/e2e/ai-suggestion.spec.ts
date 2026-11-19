import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name }).first();
    await field.fill(value);
    await field.press('Tab');
}

const value = (page: Page, name: RegExp) =>
    page.getByRole('textbox', { name }).first();

// A IA propõe; o motor confere. Candidato inviável aparece, mas não pode ser aplicado.
test('sugestão por IA: envia objetivo e limites, confere no motor e aplica com desfazer', async ({
    page,
}) => {
    let sent: Record<string, unknown> | undefined;
    await page.route('**/api/box-suggestions', async (route) => {
        sent = route.request().postDataJSON();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data: {
                    candidates: [
                        {
                            type: 'vented',
                            vb_m3: 0.08,
                            fb_hz: 27,
                            port: { shape: 'round', diameter_m: 0.1, count: 1 },
                            title: 'Grave profundo',
                            rationale: 'Caixa maior e sintonia baixa.',
                        },
                        {
                            type: 'vented',
                            vb_m3: 0.01,
                            fb_hz: 20,
                            port: { shape: 'round', diameter_m: 0.2, count: 4 },
                            title: 'Impossível',
                            rationale: 'Não cabe.',
                        },
                    ],
                },
            }),
        });
    });

    await page.goto('/');
    for (const [name, v] of [
        [/^Fs/, '28'],
        [/^Qts/, '0,38'],
        [/^Vas/, '85'],
    ] as const) {
        await fill(page, name, v);
    }
    await page.getByRole('radio', { name: 'Dutada' }).click();
    const fbBefore = await value(page, /^Fb/).inputValue();

    await page.getByRole('button', { name: 'Sugerir com IA' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Grave seco').click();
    await dialog.getByRole('textbox', { name: /^Volume máximo/ }).fill('80');
    await dialog.getByRole('button', { name: 'Pedir sugestões' }).click();

    const apply = dialog.getByRole('button', { name: 'Aplicar' });
    await expect(apply).toHaveCount(2);
    await expect(apply.nth(1)).toBeDisabled();
    await expect(
        dialog.getByText(/^Não cabe: o duto ocupa volume demais/),
    ).toBeVisible();

    expect(sent).toMatchObject({ usage: 'car', priority: 'tight' });
    expect(sent?.max_volume_m3 as number).toBeCloseTo(0.08, 5);

    await apply.first().click();
    await expect(value(page, /^Vb/)).toHaveValue('80,0');
    await expect(value(page, /^Fb/)).toHaveValue('27,0');

    await page.getByRole('button', { name: 'Desfazer' }).first().click();
    await expect(value(page, /^Fb/)).toHaveValue(fbBefore);
});
