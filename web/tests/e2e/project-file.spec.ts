import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

function field(page: Page, name: RegExp) {
    return page.getByRole('textbox', { name });
}

test('exportar, criar novo e abrir o arquivo reproduz os valores (US3)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');
    await page.getByRole('radio', { name: 'Retangular' }).click();
    await fill(page, /Largura do duto/, '50');
    await fill(page, /Altura do duto/, '300');

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('projeto.buildbass.json');
    const path = await download.path();

    await page.getByRole('button', { name: 'Novo' }).click();
    await expect(field(page, /^Fs/)).toHaveValue('');

    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (await choosing).setFiles(path);

    await expect(field(page, /^Fs/)).toHaveValue('28,0');
    await expect(field(page, /^Vas/)).toHaveValue('85,0');
    await expect(field(page, /^Vb/)).toHaveValue('60,0');
    await expect(field(page, /^Fb/)).toHaveValue('32,0');
    await expect(field(page, /Altura do duto/)).toHaveValue('300,0');
});

test('arquivo inválido mostra o motivo e não mexe no projeto (US3)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '31');

    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (
        await choosing
    ).setFiles({
        name: 'quebrado.buildbass.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ isto não é json'),
    });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('O arquivo não é um JSON válido.');
    await dialog.getByRole('button', { name: 'Fechar' }).click();
    await expect(field(page, /^Fs/)).toHaveValue('31,0');
});

test('desfazer, refazer e recarregar (US3)', async ({ page }) => {
    await page.goto('/');
    await fill(page, /^Vb/, '50');
    // Edições a menos de 400 ms viram um passo só (arrastar o slider); aqui são dois passos.
    await page.waitForTimeout(500);
    await fill(page, /^Vb/, '70');

    // Fora dos campos, para o atalho não ser o desfazer do próprio texto.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(field(page, /^Vb/)).toHaveValue('50,0');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(field(page, /^Vb/)).toHaveValue('70,0');

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(field(page, /^Vb/)).toHaveValue('50,0');

    await page.reload();
    await expect(field(page, /^Vb/)).toHaveValue('50,0');
});
