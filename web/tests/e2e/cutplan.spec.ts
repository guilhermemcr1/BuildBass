import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

function tile(page: Page, label: string) {
    return page
        .locator('[data-region="plan"] span', {
            hasText: new RegExp(`^${label}$`),
        })
        .locator('..');
}

async function openPlan(page: Page) {
    await page.getByRole('radio', { name: 'Plano de corte' }).click();
    await expect(page.locator('[data-region="plan"]')).toBeVisible();
}

// Caixa selada de 60 L do quickstart (specs/005, §1): proporção áurea, painel de 18 mm.
test('plano da selada: dimensões, tabela, espessura, proporção e volume em falta (US1)', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);

    await expect(tile(page, 'Internas · Largura')).toContainText('391,5');
    await expect(tile(page, 'Internas · Altura')).toContainText('633,4');
    await expect(tile(page, 'Internas · Profundidade')).toContainText('242,0');
    await expect(tile(page, 'Externas · Largura')).toContainText('427,5');
    await expect(tile(page, 'Externas · Altura')).toContainText('669,4');
    await expect(tile(page, 'Externas · Profundidade')).toContainText('278,0');

    const table = page.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(6);
    await expect(table.getByRole('row', { name: /Lateral/ })).toContainText(
        '2',
    );
    await expect(page.locator('[data-region="charts"]')).toHaveCount(0);

    // Espessura maior: o interior se mantém e o exterior cresce.
    await fill(page, /Espessura/, '25');
    await expect(tile(page, 'Internas · Largura')).toContainText('391,5');
    await expect(tile(page, 'Externas · Largura')).toContainText('441,5');

    // Proporção: cúbica deixa os três lados internos iguais.
    await page.getByRole('button', { name: /Proporção/ }).click();
    await page.getByRole('option', { name: 'Cúbica' }).click();
    await expect(tile(page, 'Internas · Largura')).toContainText('391,5');
    await expect(tile(page, 'Internas · Altura')).toContainText('391,5');
    await expect(tile(page, 'Internas · Profundidade')).toContainText('391,5');

    // Sem volume não há plano.
    await page
        .locator('[data-region="box"]')
        .getByRole('textbox', { name: /^Vb/ })
        .fill('');
    await page.keyboard.press('Tab');
    await expect(
        page.getByText(/Faltam parâmetros para o plano/),
    ).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);

    // Voltar para os gráficos.
    await page.getByRole('radio', { name: 'Gráficos' }).click();
    await expect(page.locator('[data-region="charts"]')).toBeVisible();
    await expect(page.locator('[data-region="plan"]')).toHaveCount(0);
});

test('plano da dutada: recorte do driver aparece na frente quando o diâmetro é informado', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '40');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);

    const front = page.getByRole('row', { name: /Frente/ });
    await expect(front).toContainText('diâmetro a informar');
    await expect(front).toContainText('Duto');

    await fill(page, /^Ød/, '285');
    await expect(front).toContainText('Driver');
    await expect(front).not.toContainText('diâmetro a informar');
});
