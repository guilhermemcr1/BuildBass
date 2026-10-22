import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockCatalog, openPicker } from './catalog-mock';

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

test.describe('US3 — busca compacta do Driver', () => {
    test('o painel não mostra campo de busca fixo; o botão abre a listagem e escolher preenche o driver (SC-005)', async ({
        page,
    }) => {
        await mockCatalog(page);
        await page.goto('/');

        await expect(page.getByRole('searchbox')).toHaveCount(0);
        await expect(page.getByRole('combobox')).toHaveCount(0);

        const search = await openPicker(page);
        await expect(search).toBeFocused();
        await search.fill('tr 6');
        await page.getByRole('option', { name: /Triton/ }).click();

        await expect(field(page, /^Fs/)).toHaveValue('76,9');
        await expect(page.getByRole('searchbox')).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: 'Buscar driver' }),
        ).toBeFocused();
    });

    test('Esc fecha a listagem sem mudar o driver e os recentes aparecem na próxima abertura', async ({
        page,
    }) => {
        await mockCatalog(page);
        await page.goto('/');

        let search = await openPicker(page);
        await search.fill('tr 6');
        await expect(
            page.getByRole('option', { name: /Triton/ }),
        ).toBeVisible();
        await page.keyboard.press('Escape');

        await expect(page.getByRole('searchbox')).toHaveCount(0);
        await expect(field(page, /^Fs/)).toHaveValue('');

        search = await openPicker(page);
        await search.fill('tr 6');
        await page.getByRole('option', { name: /Triton/ }).click();
        await expect(field(page, /^Fs/)).toHaveValue('76,9');

        await openPicker(page);
        await expect(page.getByText('Recentes')).toBeVisible();
        await expect(
            page.getByRole('option', { name: /Triton/ }),
        ).toBeVisible();
    });
});

test.describe('US4 — modal da caixa', () => {
    async function fillProject(page: Page) {
        for (const [name, value] of [
            [/^Fs/, '28'],
            [/^Qts/, '0,38'],
            [/^Qes/, '0,42'],
            [/^Qms/, '4,1'],
            [/^Vas/, '85'],
            [/^Re/, '3,6'],
            [/^Sd/, '491'],
        ] as const) {
            await field(page, name).fill(value);
            await field(page, name).press('Tab');
        }
    }

    test('abrir, mudar o volume, ver cotas e o alto-falante, e fechar com Esc devolvendo o foco (SC-006)', async ({
        page,
    }) => {
        await page.goto('/');
        await fillProject(page);
        await page.getByRole('radio', { name: 'Selada' }).click();
        await field(page, /^Vb/).fill('60');
        await field(page, /^Vb/).press('Tab');

        const opener = page.getByRole('button', { name: 'Ver caixa em 3D' });
        await opener.click();
        const dialog = page.getByRole('dialog', { name: 'Caixa' });
        await expect(dialog).toBeVisible();

        // Informar o recorte do alto-falante no modal faz o destaque aparecer.
        await dialog.getByRole('textbox', { name: /^Ød/ }).fill('200');
        await dialog.getByRole('textbox', { name: /^Ød/ }).press('Tab');
        await expect(dialog.locator('[data-part="driver"]')).toHaveCount(1);
        await expect(dialog.locator('[data-driver-label]')).toHaveText(
            'Alto-falante',
        );

        const widthBefore = await dialog
            .locator('[data-dimension="width"] text')
            .textContent();
        await dialog.getByRole('textbox', { name: /^Vb/ }).fill('90');
        await dialog.getByRole('textbox', { name: /^Vb/ }).press('Tab');
        await expect(
            dialog.locator('[data-dimension="width"] text'),
        ).not.toHaveText(widthBefore ?? '');
        for (const axis of ['width', 'height', 'depth']) {
            await expect(
                dialog.locator(`[data-dimension="${axis}"] text`),
            ).toContainText('mm');
        }

        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
        await expect(field(page, /^Vb/)).toHaveValue('90,0');
    });

    test('a 360 px o modal ocupa a tela e não rola na horizontal', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto('/');
        await page.getByRole('button', { name: 'Ampliar caixa' }).click();
        const dialog = page.getByRole('dialog', { name: 'Caixa' });
        await expect(dialog).toBeVisible();

        const rect = await dialog.boundingBox();
        expect(rect!.width).toBeGreaterThanOrEqual(360 - 40);
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
