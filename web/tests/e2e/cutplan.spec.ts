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

    const table = page.getByRole('table', { name: /Lista de corte/ });
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

test('conferência: o líquido do plano é o da simulação e os avisos citam a peça (US2)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);

    const check = page.getByRole('table', { name: /Volume por câmara/ });
    await expect(check).toBeVisible();
    await expect(check.getByRole('row', { name: /Dutos/ })).not.toContainText(
        '—',
    );
    await expect(page.getByText(/Igual à simulação/)).toBeVisible();

    // O tubo calculado é mais longo que a caixa: o plano pede curva ou dobra.
    await expect(page.getByText(/precisará de curva ou dobra/)).toBeVisible();

    // Recorte grande demais: erro nomeando a peça, com texto.
    await fill(page, /^Ød/, '700');
    const warnings = page.getByRole('list', { name: 'Avisos do plano' });
    await expect(warnings).toContainText(/não cabe no lado menor de frente/);

    await fill(page, /^Ød/, '285');
    await expect(warnings).not.toContainText(/não cabe no lado menor/);
    await expect(page.getByText(/Igual à simulação/)).toBeVisible();
});

test('sem volume o plano diz o que falta e some a conferência (US2)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
    await expect(page.getByText(/Igual à simulação/)).toBeVisible();

    await page
        .locator('[data-region="box"]')
        .getByRole('textbox', { name: /^Vb/ })
        .fill('');
    await page.keyboard.press('Tab');
    await expect(
        page.getByText(/Faltam parâmetros para o plano/),
    ).toBeVisible();
    await expect(page.getByText(/Igual à simulação/)).toHaveCount(0);
});

// Bandpass do quickstart (specs/005, §4): 40 + 60 L, áurea, painel de 18 mm.
test('plano da bandpass: sete peças, divisória, câmaras e conferência por câmara (US3)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Bandpass' }).click();
    await fill(page, /^Vr/, '40');
    await fill(page, /^Vf/, '60');
    await fill(page, /^Fb/, '45');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);
    await fill(page, /^Ød/, '200');

    const parts = page.getByRole('table', { name: /Lista de corte/ });
    await expect(parts.locator('tbody tr')).toHaveCount(6);

    const divider = parts.getByRole('row', { name: /Divisória/ });
    await expect(divider).toContainText('Entre as câmaras');
    await expect(divider).toContainText('Driver');
    await expect(parts.getByRole('row', { name: /Frente/ })).toContainText(
        'Duto',
    );

    await expect(tile(page, 'Profundidade da câmara traseira')).toContainText(
        '114,7',
    );
    await expect(tile(page, 'Profundidade da câmara frontal')).toContainText(
        '172,1',
    );
    await expect(tile(page, 'Internas · Profundidade')).toContainText('286,9');
    await expect(tile(page, 'Externas · Profundidade')).toContainText('340,9');

    const check = page.getByRole('table', { name: /Volume por câmara/ });
    await expect(
        check.getByRole('columnheader', { name: 'Câmara traseira' }),
    ).toBeVisible();
    await expect(
        check.getByRole('columnheader', { name: 'Câmara frontal' }),
    ).toBeVisible();
    await expect(page.getByText(/Igual à simulação/)).toBeVisible();

    // Trocar de tipo e voltar não perde a espessura nem a proporção.
    await fill(page, /Espessura/, '25');
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await expect(
        page.getByText(/Faltam parâmetros para o plano: .*Vb/),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Bandpass' }).click();
    await expect(parts.locator('tbody tr')).toHaveCount(6);
    await expect(page.getByRole('textbox', { name: /Espessura/ })).toHaveValue(
        /25/,
    );
});

test('desenhos 2D e vista 3D: um desenho por peça, girar por teclado e por botões (US4)', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Bandpass' }).click();
    await fill(page, /^Vr/, '40');
    await fill(page, /^Vf/, '60');
    await fill(page, /^Fb/, '45');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);
    await fill(page, /^Ød/, '200');

    // Desenhos 2D: um por linha da tabela, e a lista em texto continua inteira.
    await expect(
        page.getByRole('tab', { name: 'Desenhos 2D' }),
    ).toHaveAttribute('aria-selected', 'true');
    const drawings = page.locator(
        '[data-region="plan"] figure svg[role="img"]',
    );
    await expect(drawings).toHaveCount(6);
    await expect(page.getByRole('img', { name: 'Divisória' })).toBeVisible();
    await expect(
        page.getByRole('table', { name: /Lista de corte/ }).locator('tbody tr'),
    ).toHaveCount(6);

    // Vista 3D: carrega ao abrir a aba e gira.
    await page.getByRole('tab', { name: 'Vista 3D' }).click();
    const box = page.locator('[data-region="plan"] svg[data-yaw]');
    await expect(box).toBeVisible();
    await expect(box).toHaveAccessibleName(/bandpass.*de largura/);

    const yaw = async () => Number(await box.getAttribute('data-yaw'));
    const start = await yaw();

    await box.focus();
    await page.keyboard.press('ArrowRight');
    expect(await yaw()).toBeGreaterThan(start);

    await page.getByRole('button', { name: 'Girar para a esquerda' }).click();
    await page.getByRole('button', { name: 'Girar para a esquerda' }).click();
    expect(await yaw()).toBeLessThan(start);

    await box.focus();
    await page.keyboard.press('Home');
    expect(await yaw()).toBeCloseTo(start, 3);

    // Por dentro: a divisória aparece.
    await expect(box.locator('[data-id="divider"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver por dentro' }).click();
    await expect(box.locator('[data-id="divider"]')).toHaveCount(1);
});
