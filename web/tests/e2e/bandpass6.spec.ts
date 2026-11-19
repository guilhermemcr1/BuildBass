import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

async function fill(field: Locator, value: string) {
    await field.fill(value);
    await field.press('Tab');
}

function byName(page: Page, name: RegExp) {
    return page.getByRole('textbox', { name });
}

function tile(page: Page, label: string) {
    return page
        .locator('[data-region="results"] span', {
            hasText: new RegExp(`^${label}$`),
        })
        .locator('..');
}

const rearChamber = (page: Page) =>
    page.getByRole('group', {
        name: 'Câmara traseira (dutada)',
        exact: true,
    });
const frontChamber = (page: Page) =>
    page.getByRole('group', {
        name: 'Câmara frontal (dutada)',
        exact: true,
    });

// Driver de referência da quickstart da 004; a feature 007 não usa a API.
async function referenceDriver(page: Page) {
    await fill(byName(page, /^Fs/), '28');
    await fill(byName(page, /^Qts/), '0,38');
    await fill(byName(page, /^Qes/), '0,42');
    await fill(byName(page, /^Qms/), '4,1');
    await fill(byName(page, /^Vas/), '85');
    await fill(byName(page, /^Re/), '3,6');
    await fill(byName(page, /^Le —/), '2,1');
    await fill(byName(page, /^Xmax/), '14');
    await fill(byName(page, /^Sd/), '491');
}

async function sixthOrderBox(page: Page) {
    await page.getByRole('radio', { name: 'Bandpass 6ª ordem' }).click();

    const rear = rearChamber(page);
    await fill(rear.getByRole('textbox', { name: /^Vr/ }), '80');
    await fill(rear.getByRole('textbox', { name: /^Fbr/ }), '30');
    await fill(rear.getByRole('textbox', { name: /Diâmetro/ }), '100');

    const front = frontChamber(page);
    await fill(front.getByRole('textbox', { name: /^Vf/ }), '40');
    await fill(front.getByRole('textbox', { name: /^Fb(?!r)/ }), '45');
    await fill(front.getByRole('textbox', { name: /Diâmetro/ }), '100');
}

test('bandpass 6ª ordem: escolher o tipo, preencher as duas câmaras e ver curvas e resultados', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await sixthOrderBox(page);

    await expect(rearChamber(page)).toBeVisible();
    await expect(frontChamber(page)).toBeVisible();

    for (const label of [
        'Corte inferior',
        'Corte superior',
        'Largura da banda',
        'Fbr',
        'Comprimento do duto frontal',
        'Comprimento do duto traseiro',
        'Velocidade máx. no duto traseiro',
    ]) {
        await expect(tile(page, label), label).not.toContainText('—');
    }

    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();
    await expect(
        page.getByText('Faltam parâmetros para desenhar o gráfico'),
    ).toHaveCount(0);

    for (const tab of [
        'Excursão',
        'Impedância',
        'Atraso de grupo',
        'Velocidade no duto',
    ]) {
        await page.getByRole('tab', { name: tab }).click();
        await expect(
            page.locator('[data-region="charts"] canvas'),
        ).toBeVisible();
    }
});

test('bandpass 6ª ordem: a aba de velocidade lê o duto frontal e o traseiro', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await sixthOrderBox(page);

    await page.getByRole('tab', { name: 'Velocidade no duto' }).click();
    const chart = page.getByRole('group', { name: 'Velocidade no duto' });
    await chart.focus();
    await chart.press('Home');

    await expect(chart.locator('[aria-live="polite"]')).toContainText(
        /frontal.*traseiro/,
    );
});

test('bandpass 6ª ordem: mudar a sintonia frontal atualiza os resultados sem ação extra', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await sixthOrderBox(page);

    const high = tile(page, 'Corte superior');
    await expect(high).not.toContainText('—');
    const before = await high.textContent();

    await fill(
        frontChamber(page).getByRole('textbox', { name: /^Fb(?!r)/ }),
        '60',
    );
    await expect(high).not.toHaveText(before ?? '');
});

test('bandpass 6ª ordem: Fbr vazio diz o que falta e o resto continua', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await sixthOrderBox(page);

    await fill(rearChamber(page).getByRole('textbox', { name: /^Fbr/ }), '');

    await expect(
        page.getByText('Faltam parâmetros para desenhar o gráfico'),
    ).toBeVisible();
    await expect(page.getByText(/Preencha .*Fbr/)).toBeVisible();
    await expect(tile(page, 'Fbr')).toContainText('—');
});
