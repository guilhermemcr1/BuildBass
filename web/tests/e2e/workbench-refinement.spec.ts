import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Refinamento da bancada (feature 008): um cenário por história.

test.use({ viewport: { width: 1440, height: 900 } });

function field(page: Page, name: RegExp) {
    return page.getByRole('textbox', { name });
}

async function box(page: Page, selector: string) {
    const rect = await page.locator(selector).first().boundingBox();

    expect(rect).not.toBeNull();

    return rect!;
}

test.describe('US1 — campos que não expandem', () => {
    test('focar um campo não muda o tamanho nem a posição de nenhum elemento (SC-001)', async ({
        page,
    }) => {
        await page.goto('/');
        const driver = '[data-region="driver"]';
        const before = {
            panel: await box(page, driver),
            qts: await field(page, /^Qts/).boundingBox(),
            fs: await field(page, /^Fs/).boundingBox(),
        };

        await field(page, /^Fs/).click();
        await expect(field(page, /^Fs/)).toBeFocused();

        expect(await box(page, driver)).toEqual(before.panel);
        expect(await field(page, /^Qts/).boundingBox()).toEqual(before.qts);
        expect(await field(page, /^Fs/).boundingBox()).toEqual(before.fs);

        await field(page, /^Qts/).click();
        await expect(field(page, /^Qts/)).toBeFocused();
        expect(await box(page, driver)).toEqual(before.panel);
    });

    test('a explicação aparece como tooltip ao focar o campo e some com Esc', async ({
        page,
    }) => {
        await page.goto('/');

        await field(page, /^Fs/).focus();
        const tip = page.getByRole('tooltip');
        await expect(tip).toContainText(
            'Frequência em que o cone ressoa livre no ar',
        );

        await page.keyboard.press('Escape');
        await expect(tip).toBeHidden();
    });

    test('a explicação aparece como tooltip ao pairar o símbolo e o campo', async ({
        page,
    }) => {
        await page.goto('/');
        const driver = page.locator('[data-region="driver"]');
        const tip = page.getByRole('tooltip');

        // O primeiro movimento do mouse arma os ouvintes globais do React Aria; usuários sempre
        // mexem o mouse antes de chegar ao símbolo.
        await page.mouse.move(10, 10);
        await page.mouse.move(40, 40);
        await driver.getByText('Qts', { exact: true }).first().hover();
        await expect(tip).toContainText('Amortecimento total');

        await page.mouse.move(0, 0);
        await expect(tip).toBeHidden();

        await field(page, /^Qts/).hover();
        await expect(tip).toBeVisible();
    });

    test('o status mostra ícone e texto curto', async ({ page }) => {
        await page.goto('/');
        await field(page, /^Fs/).fill('28');
        await field(page, /^Fs/).press('Tab');

        await expect(
            page
                .locator('[data-region="driver"]')
                .getByText(/^(OK|Atenção|Erro|Sem verif\.)$/)
                .first(),
        ).toBeVisible();
    });
});

test.describe('US2 — abas com cor acima do Driver', () => {
    const tabs = (page: Page) =>
        page.getByRole('navigation', { name: 'Projetos abertos' });

    // O radio fica escondido sob a amostra; o usuário clica na amostra (o rótulo).
    const pickColor = (page: Page, n: number) =>
        page
            .locator('label')
            .filter({ has: page.getByRole('radio', { name: `Cor ${n}` }) })
            .click();

    test('as abas ficam acima do Driver e a barra mostra só o nome do projeto', async ({
        page,
    }) => {
        await page.goto('/');

        const tabsBox = await tabs(page).boundingBox();
        const driverBox = await box(page, '[data-region="driver"]');

        expect(tabsBox).not.toBeNull();
        expect(tabsBox!.y + tabsBox!.height).toBeLessThanOrEqual(driverBox.y);
        await expect(
            page.locator('header').getByRole('navigation', {
                name: 'Projetos abertos',
            }),
        ).toHaveCount(0);

        const name = page.getByRole('textbox', { name: 'Nome do projeto' });
        await name.fill('Caixa A');
        await name.press('Enter');
        await expect(
            tabs(page).getByRole('button', { name: /^Caixa A/ }),
        ).toBeVisible();
    });

    test('duas cores escolhidas identificam as curvas na legenda (SC-004)', async ({
        page,
    }) => {
        await page.goto('/');
        await field(page, /^Vb/).fill('40');
        await field(page, /^Vb/).press('Tab');
        await page.getByRole('button', { name: 'Novo' }).click();
        await field(page, /^Vb/).fill('120');
        await field(page, /^Vb/).press('Tab');

        const colorButtons = tabs(page).getByRole('button', {
            name: /^Cor de /,
        });

        await colorButtons.nth(0).click();
        await pickColor(page, 5);
        await page.keyboard.press('Escape');
        await colorButtons.nth(1).click();
        await pickColor(page, 6);
        await page.keyboard.press('Escape');

        const legend = page.getByRole('list', { name: 'Projetos no gráfico' });

        await expect(legend.locator('.bg-series-5')).toHaveCount(1);
        await expect(legend.locator('.bg-series-6')).toHaveCount(1);
    });
});
