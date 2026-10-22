import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('sem conexão mostra o aviso, desativa o servidor e preserva os dados', async ({
    page,
    context,
}) => {
    await page.goto('/');
    const fs = page.getByRole('textbox', { name: /Fs/ });
    await fs.fill('28,5');
    await fs.press('Tab');

    const banner = page.getByRole('status').filter({ hasText: 'Sem conexão.' });
    const pick = page.getByRole('button', { name: 'Buscar driver' });
    const catalog = page.getByRole('searchbox', { name: 'Buscar driver' });
    const submit = page.getByRole('button', { name: /Enviar driver/ });

    await pick.click();
    await expect(catalog).toBeEnabled();
    await page.keyboard.press('Escape');

    await context.setOffline(true);

    await expect(banner).toBeVisible({ timeout: 5000 });
    await pick.click();
    // O campo segue ativo offline: "Meus alto-falantes" é local; só catálogo e recentes caem.
    await expect(catalog).toBeEnabled();
    await expect(
        page.getByText('Indisponível sem conexão com o servidor.').first(),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(submit).toBeDisabled();
    await expect(fs).toHaveValue('28,5');

    await context.setOffline(false);

    await expect(banner).toBeHidden({ timeout: 5000 });
    await pick.click();
    await expect(catalog).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(fs).toHaveValue('28,5');
});
