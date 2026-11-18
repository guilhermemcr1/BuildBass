import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Plano de corte avançado: estoque de chapas, tipo de corte e posição dos recortes.

test.use({ viewport: { width: 1440, height: 900 } });

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

// A folha de impressão também está na página (oculta na tela): os textos se procuram no painel.
function planRegion(page: Page) {
    return page.locator('[data-region="plan"]');
}

async function fillPlan(page: Page, name: RegExp, value: string) {
    const field = planRegion(page).getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

async function openPlan(page: Page) {
    const toggle = page.getByRole('button', {
        name: 'Plano de corte',
        exact: true,
    });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
        await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

// Selada de 60 L do quickstart da 005, com o recorte do alto-falante informado.
async function sealedBox(page: Page) {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
}

async function download(page: Page, button: string, exact = false) {
    const [file] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: button, exact }).click(),
    ]);
    const path = await file.path();

    return { path, text: await readFile(path, 'utf8') };
}

test('estoque com sobra, quantidade, corte livre e arquivo v7 que volta igual', async ({
    page,
}) => {
    await sealedBox(page);
    await fill(page, /^Wc/, '2750');
    await fill(page, /^Hc/, '1850');

    await planRegion(page)
        .getByRole('button', { name: 'Adicionar chapa' })
        .click();
    await fillPlan(page, /^Item 2:.*Largura da chapa/, '900');
    await fillPlan(page, /^Item 2:.*Altura da chapa/, '600');

    // No modo Normal a quantidade fica em "Mostrar mais"; no Pro já está aberta.
    const more = planRegion(page).getByRole('button', {
        name: /^Mostrar mais/,
    });
    if ((await more.count()) > 0) {
        await more.click();
    }
    await fillPlan(page, /^Item 2:.*Quantidade/, '2');
    await expect(
        planRegion(page).getByText('Sem limite', { exact: true }),
    ).toHaveCount(1);

    await planRegion(page)
        .getByRole('radio', { name: 'CNC/tupia (livre)' })
        .click();

    await planRegion(page).getByRole('tab', { name: 'Chapas' }).click();
    await expect(planRegion(page).getByTestId('by-stock')).toBeVisible();
    await expect(
        planRegion(page).getByText(/corte livre \(CNC ou tupia\)/),
    ).toBeVisible();
    await expect(planRegion(page).getByTestId('cut-mode')).toHaveText(
        'Tipo de corte: CNC/tupia (livre).',
    );

    const csv = await download(page, 'Exportar CSV');
    expect(csv.text).toContain(
        'Chapas;Chapa;Item do estoque;Peça;Unidade;x (mm);y (mm)',
    );
    expect(csv.text).toContain('Tipo de corte;CNC/tupia (livre)');

    const file = await download(page, 'Salvar', true);
    const saved = JSON.parse(file.text);
    expect(saved.version).toBe(7);
    expect(saved.project.cutPlan.sheet).toMatchObject({
        w_m: 2.75,
        h_m: 1.85,
        more: [{ w_m: 0.9, h_m: 0.6, quantity: 2 }],
        cut: 'free',
    });

    await page.getByRole('button', { name: 'Novo' }).click();
    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (await choosing).setFiles(file.path);
    await openPlan(page);

    await expect(
        planRegion(page).getByRole('textbox', {
            name: /^Item 2:.*Largura da chapa/,
        }),
    ).toHaveValue('900,0');
    await expect(
        planRegion(page).getByRole('radio', { name: 'CNC/tupia (livre)' }),
    ).toBeChecked();
});

test('posição do recorte por medida, teclado e arrasto; desfazer e CSV', async ({
    page,
}) => {
    await sealedBox(page);
    await fillPlan(page, /^Ød/, '200');

    await planRegion(page).getByRole('tab', { name: 'Desenhos 2D' }).click();
    await planRegion(page)
        .getByRole('button', { name: 'Posicionar recortes de frente' })
        .click();

    const dialog = page.getByRole('dialog', {
        name: 'Posicionar recortes — Frente',
    });
    await expect(dialog).toBeVisible();

    const x = dialog.getByRole('textbox', {
        name: /^Alto-falante 1:.*borda esquerda/,
    });
    const y = dialog.getByRole('textbox', {
        name: /^Alto-falante 1:.*borda de baixo/,
    });

    // Por medida.
    await x.fill('150');
    await x.press('Tab');
    await expect(
        dialog.getByRole('button', { name: 'Alto-falante 1, posição manual' }),
    ).toBeVisible();

    // Pelo teclado: 1 mm por toque, 10 mm com Shift.
    const driver = dialog.getByRole('button', { name: /^Alto-falante 1,/ });
    await driver.focus();
    await page.keyboard.press('ArrowRight');
    await expect(x).toHaveValue('151,0');
    await page.keyboard.press('Shift+ArrowUp');
    const yAfterKeys = await y.inputValue();
    await expect(dialog.getByRole('status')).toHaveText(
        /^Alto-falante 1: 151,0 mm da esquerda, .* de baixo\.$/,
    );

    // Arrastando: o centro anda em passos de 1 mm.
    const box = await driver.boundingBox();
    if (box === null) {
        throw new Error('recorte sem caixa');
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 20, cy + 10, { steps: 5 });
    await page.mouse.move(cx + 40, cy + 20, { steps: 5 });
    await page.mouse.up();

    await expect(x).not.toHaveValue('151,0');
    const dragged = await x.inputValue();
    expect(dragged).toMatch(/^\d+,0$/);
    expect(Number(dragged.replace(',', '.'))).toBeGreaterThan(151);
    await expect(y).not.toHaveValue(yAfterKeys);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(
        planRegion(page).locator('[data-centers]').first(),
    ).toContainText(`Alto-falante 1: centro a ${dragged} mm da esquerda`);

    // O arrasto inteiro é uma etapa do Desfazer.
    await page.getByRole('button', { name: /^Desfazer/ }).click();
    await expect(
        planRegion(page).locator('[data-centers]').first(),
    ).toContainText('Alto-falante 1: centro a 151,0 mm da esquerda');

    const csv = await download(page, 'Exportar CSV');
    expect(csv.text).toContain(
        'Recortes;Peça;Recorte;Medida;Centro da esquerda (mm);Centro de baixo (mm);Posição',
    );
    expect(csv.text).toMatch(/;Frente;Alto-falante 1;[^;]*;151,0;[^;]*;manual/);
});
