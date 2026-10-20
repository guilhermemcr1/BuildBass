import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

function tile(page: Page, label: string) {
    return page
        .locator('[data-region="results"] span', { hasText: new RegExp(`^${label}$`) })
        .locator('..');
}

test('com driver e caixa preenchidos a bancada calcula e desenha (US1)', async ({ page }) => {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');

    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '50');

    await expect(tile(page, 'F3')).not.toContainText('—');
    await expect(tile(page, 'Qtc')).not.toContainText('—');
    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();
    await expect(page.getByText('Faltam parâmetros para desenhar o gráfico')).toHaveCount(0);
});

test('na dutada, mudar Fb muda o F3 sem ação extra (US1)', async ({ page }) => {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '28');

    const f3 = tile(page, 'F3');
    await expect(f3).not.toContainText('—');
    const before = await f3.textContent();

    await fill(page, /^Fb/, '40');
    await expect(f3).not.toHaveText(before ?? '');
});
