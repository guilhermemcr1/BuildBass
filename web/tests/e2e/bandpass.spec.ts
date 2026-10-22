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
        .locator('[data-region="results"] span', {
            hasText: new RegExp(`^${label}$`),
        })
        .locator('..');
}

// Driver de referência do quickstart (specs/004, §2).
async function referenceDriver(page: Page) {
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Qes/, '0,42');
    await fill(page, /^Qms/, '4,1');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Re/, '3,6');
    await fill(page, /^Le/, '2,1');
    await fill(page, /^Xmax/, '14');
    await fill(page, /^Sd/, '491');
}

async function bandpassBox(page: Page) {
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();
    await fill(page, /^Vr/, '40');
    await fill(page, /^Vf/, '60');
    await fill(page, /^Fb/, '45');
    await fill(page, /Diâmetro do duto/, '100');
}

test('bandpass: escolher o tipo, preencher as câmaras e ver curvas e cortes (US1)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await bandpassBox(page);

    await expect(tile(page, 'Corte inferior')).not.toContainText('—');
    await expect(tile(page, 'Corte superior')).not.toContainText('—');
    await expect(tile(page, 'Largura da banda')).not.toContainText('—');
    await expect(tile(page, 'Comprimento do duto')).not.toContainText('—');
    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();
    await expect(
        page.getByText('Faltam parâmetros para desenhar o gráfico'),
    ).toHaveCount(0);
    await expect(page.getByText('F3', { exact: true })).toHaveCount(0);

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

test('bandpass: mudar a sintonia atualiza os cortes sem ação extra (US1)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await bandpassBox(page);

    const high = tile(page, 'Corte superior');
    await expect(high).not.toContainText('—');
    const before = await high.textContent();

    await fill(page, /^Fb/, '60');
    await expect(high).not.toHaveText(before ?? '');
});

test('bandpass: o seletor tem as quatro opções e nenhum aviso de indisponível (US1)', async ({
    page,
}) => {
    await page.goto('/');

    for (const name of [
        'Selada',
        'Dutada',
        'Bandpass 4ª ordem',
        'Bandpass 6ª ordem',
    ]) {
        await expect(page.getByRole('radio', { name })).toBeEnabled();
    }

    await expect(page.getByText(/chega numa próxima versão/)).toHaveCount(0);
});

test('bandpass: câmara traseira pequena demais avisa e nenhum gráfico quebra (US3)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await fill(page, /^Vd/, '2');
    await bandpassBox(page);
    await fill(page, /^Vr/, '1');

    await expect(page.getByText(/maior que a câmara traseira/)).toBeVisible();
    // Sem curva absurda: o gráfico mostra o estado vazio e a tela continua funcionando.
    await expect(
        page.getByText('Faltam parâmetros para desenhar o gráfico').first(),
    ).toBeVisible();

    await fill(page, /^Vr/, '40');
    await expect(page.getByText(/maior que a câmara traseira/)).toHaveCount(0);
    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();
});

test('bandpass: duto fino com potência alta mostra o erro de velocidade com texto (US3)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await bandpassBox(page);
    await fill(page, /Diâmetro do duto/, '20');
    await fill(page, /Potência de entrada/, '400');

    const velocity = page
        .locator('[data-region="results"] span', {
            hasText: /^Velocidade máx\. no duto$/,
        })
        .locator('..');
    await expect(velocity).toContainText(/Acima de/);
});

test('três projetos plotados (selada, dutada, bandpass): curvas, legenda e tabela (US4)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '50');

    await page.getByRole('button', { name: 'Novo' }).click();
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');

    await page.getByRole('button', { name: 'Novo' }).click();
    await referenceDriver(page);
    await bandpassBox(page);

    const legend = page.getByRole('list', { name: 'Projetos no gráfico' });
    await expect(legend.getByRole('listitem')).toHaveCount(3);
    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();

    // Com vários projetos a tabela de comparação começa recolhida.
    await page
        .locator('[data-region="results"]')
        .getByRole('button', { name: 'Resultados' })
        .click();
    const table = page.locator('[data-region="results"] table');
    await expect(table.getByRole('columnheader')).toHaveCount(4);
    await expect(
        table.getByRole('row', { name: /^Corte inferior/ }),
    ).toBeVisible();
    await expect(table.getByRole('row', { name: /^F3/ })).toBeVisible();

    for (const tab of ['Excursão', 'Impedância', 'Velocidade no duto']) {
        await page.getByRole('tab', { name: tab }).click();
        await expect(
            page.locator('[data-region="charts"] canvas'),
        ).toBeVisible();
    }
});

test('bandpass: só pelo teclado, Tab alcança tipo, câmaras, Fb, Ql e duto e as setas movem o foco do seletor (US5)', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();

    const targets = [/^Vr/, /^Vf/, /^Fb/, /^Ql/, /Diâmetro do duto/];

    for (const name of targets) {
        await expect(page.getByRole('textbox', { name })).toHaveAccessibleName(
            name,
        );
    }

    // Seletor de tipo (ToggleButtonGroup): as setas movem o foco entre as opções e Espaço escolhe.
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Dutada' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: 'Dutada' })).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(
        page.getByRole('radio', { name: 'Bandpass 4ª ordem' }),
    ).toBeChecked();

    // Só com Tab, a partir do seletor, o foco passa por todos os campos da caixa.
    const pending = new Set(targets.map(String));
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).focus();

    for (let step = 0; step < 30 && pending.size > 0; step++) {
        await page.keyboard.press('Tab');

        for (const name of targets) {
            const focused = await page
                .getByRole('textbox', { name })
                .evaluate((element) => element === document.activeElement);

            if (focused) {
                pending.delete(String(name));
            }
        }
    }

    expect([...pending]).toEqual([]);
});
