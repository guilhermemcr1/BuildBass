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
    const catalog = page.getByRole('combobox', { name: 'Catálogo de drivers' });
    const submit = page.getByRole('button', { name: /Enviar driver/ });

    await expect(catalog).toBeEnabled();

    await context.setOffline(true);

    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(catalog).toBeDisabled();
    await expect(submit).toBeDisabled();
    await expect(
        page.getByText('Indisponível sem conexão com o servidor.').first(),
    ).toBeVisible();
    await expect(fs).toHaveValue('28,5');

    await context.setOffline(false);

    await expect(banner).toBeHidden({ timeout: 5000 });
    await expect(catalog).toBeEnabled();
    await expect(fs).toHaveValue('28,5');
});
