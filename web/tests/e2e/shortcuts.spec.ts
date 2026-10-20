import { expect, test } from '@playwright/test';

test('atalhos trocam o gráfico, abrem a ajuda e exportam (FR-028)', async ({
    page,
}) => {
    await page.goto('/');
    await page.locator('[data-region="driver"]').waitFor();

    await page.keyboard.press('3');
    await expect(page.getByRole('tab', { name: 'Impedância' })).toHaveAttribute(
        'aria-selected',
        'true',
    );

    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Atalhos de teclado' });
    await expect(help).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();

    const downloading = page.waitForEvent('download');
    await page.keyboard.press('ControlOrMeta+s');
    expect((await downloading).suggestedFilename()).toBe(
        'projeto.buildbass.json',
    );
});

test('as teclas 1–5 não trocam o gráfico com o foco num campo', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: /^Fs/ }).click();
    await page.keyboard.press('2');

    await expect(page.getByRole('tab', { name: 'Resposta' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
});
