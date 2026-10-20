import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('sem preferência salva segue o tema escuro do sistema', async ({
    browser,
}) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await context.close();
});

test('o tema escolhido continua depois de recarregar', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/');

    await page.getByRole('radio', { name: 'Claro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await context.close();
});

test('trocar para inglês mantém o valor em edição e muda textos e lang', async ({
    browser,
}) => {
    const context = await browser.newContext({ locale: 'pt-BR' });
    const page = await context.newPage();
    await page.goto('/');

    const fs = page.getByRole('textbox', { name: /Fs/ });
    await fs.fill('28,5');
    await fs.press('Tab');

    await page.getByRole('button', { name: /Idioma/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
        page.getByRole('button', { name: 'Export', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Fs/ })).toHaveValue('28.5');
    await context.close();
});

test('com localStorage bloqueado as trocas funcionam sem erro', async ({
    browser,
}) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    await context.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
            get() {
                throw new DOMException('bloqueado', 'SecurityError');
            },
        });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });

    await page.goto('/');
    await page.getByRole('radio', { name: 'Escuro' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
    await context.close();
});
