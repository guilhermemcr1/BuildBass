import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

async function setup(page: Page) {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '50');
    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();
}

const chart = (page: Page) =>
    page.locator(
        '[data-region="charts"] [role="group"][aria-label="Resposta"]',
    );

test('o tooltip mostra o projeto, o valor no ponto e o pico da curva', async ({
    page,
}) => {
    await setup(page);
    const box = await chart(page).boundingBox();

    await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height / 2);

    const tooltip = page.getByTestId('chart-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Projeto sem nome');
    await expect(tooltip).toContainText('Pico');
    await expect(tooltip).toContainText('dB');
});

test('a faixa vai até 20 kHz e os resultados não mudam', async ({ page }) => {
    await setup(page);
    const f3 = page
        .locator('[data-region="results"] span', { hasText: /^F3$/ })
        .locator('..');
    const before = await f3.textContent();
    const range = page.getByRole('radiogroup', { name: 'Faixa de frequência' });

    await expect(range.getByRole('radio', { name: 'Até 1 kHz' })).toBeChecked();

    await range.getByRole('radio', { name: 'Até 20 kHz' }).click();
    await expect(
        range.getByRole('radio', { name: 'Até 20 kHz' }),
    ).toBeChecked();

    // O tooltip no fim do eixo lê um ponto perto de 20 kHz.
    const box = await chart(page).boundingBox();
    await page.mouse.move(box!.x + box!.width - 30, box!.y + box!.height / 2);
    await expect(page.getByTestId('chart-tooltip')).toContainText(
        /\d{2}[.,\s]?\d* ?(k?Hz)/,
    );

    expect(await f3.textContent()).toBe(before);
});

test('arrastar amplia, e o botão e o duplo clique voltam', async ({ page }) => {
    await setup(page);
    const box = await chart(page).boundingBox();
    const y = box!.y + box!.height / 2;
    const reset = page.getByRole('button', { name: 'Redefinir zoom' });

    await expect(reset).toHaveCount(0);

    await page.mouse.move(box!.x + box!.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, y, { steps: 8 });
    await page.mouse.up();
    await expect(reset).toBeVisible();

    await reset.click();
    await expect(reset).toHaveCount(0);

    await page.mouse.move(box!.x + box!.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, y, { steps: 8 });
    await page.mouse.up();
    await expect(reset).toBeVisible();

    await page.mouse.dblclick(box!.x + box!.width * 0.5, y);
    await expect(reset).toHaveCount(0);
});

test('trocar a faixa desfaz o zoom', async ({ page }) => {
    await setup(page);
    const box = await chart(page).boundingBox();
    const y = box!.y + box!.height / 2;

    await page.mouse.move(box!.x + box!.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, y, { steps: 8 });
    await page.mouse.up();
    await expect(
        page.getByRole('button', { name: 'Redefinir zoom' }),
    ).toBeVisible();

    await page
        .getByRole('radiogroup', { name: 'Faixa de frequência' })
        .getByRole('radio', { name: 'Até 5 kHz' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Redefinir zoom' }),
    ).toHaveCount(0);
});
