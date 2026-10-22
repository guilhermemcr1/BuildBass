import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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

    await page.getByRole('button', { name: /^Tema:/ }).click();
    await page.getByRole('menuitemradio', { name: 'Claro' }).click();
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
    await page.getByRole('button', { name: /^Tema:/ }).click();
    await page.getByRole('menuitemradio', { name: 'Escuro' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
    await context.close();
});

// Modo Normal/Pro (feature 008, US7): os cenários partem do Normal, sem o Pro que a configuração
// dos testes liga por padrão.
test.describe('modo Normal e Pro', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    const advanced = (page: Page) =>
        page.getByRole('textbox', { name: /^Qes/ });
    const kerf = (page: Page) => page.getByRole('textbox', { name: /^Ps\s?—/ });
    const pro = (page: Page) => page.getByRole('switch', { name: 'Modo Pro' });
    // O input do switch fica escondido sob o desenho dele; o usuário clica no rótulo.
    const toggle = (page: Page) => page.getByText('Modo Pro');

    test('Normal começa recolhido; Pro expande tudo; Normal recolhe; abrir à mão não mexe no outro', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(pro(page)).not.toBeChecked();
        await expect(advanced(page)).toHaveCount(0);
        await expect(page.getByRole('textbox', { name: /^Fs/ })).toBeVisible();

        // Abrir o do driver à mão, sem tocar no modo.
        await page.getByRole('button', { name: 'Mostrar mais' }).click();
        await expect(advanced(page)).toBeVisible();
        await expect(pro(page)).not.toBeChecked();

        // Pro abre o plano também, sem outro clique.
        await page
            .getByRole('button', { name: 'Plano de corte', exact: true })
            .click();
        await expect(kerf(page)).toHaveCount(0);
        await toggle(page).click();
        await expect(kerf(page)).toBeVisible();
        await expect(advanced(page)).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Mostrar (mais|menos)/ }),
        ).toHaveCount(2);

        await toggle(page).click();
        await expect(kerf(page)).toHaveCount(0);
        await expect(advanced(page)).toHaveCount(0);
    });

    test('o modo persiste ao recarregar e as seções seguem o modo', async ({
        page,
    }) => {
        await page.goto('/');
        await toggle(page).click();
        await page.reload();

        await expect(pro(page)).toBeChecked();
        await expect(advanced(page)).toBeVisible();

        await toggle(page).click();
        await page.reload();

        await expect(pro(page)).not.toBeChecked();
        await expect(advanced(page)).toHaveCount(0);
    });

    test('campo recolhido continua valendo: os resultados são os mesmos no Normal e no Pro', async ({
        page,
    }) => {
        await page.goto('/');
        await toggle(page).click();

        for (const [name, value] of [
            [/^Fs/, '28'],
            [/^Qts/, '0,38'],
            [/^Vas/, '85'],
            [/^Re/, '3,6'],
            [/^Sd/, '491'],
        ] as const) {
            const field = page.getByRole('textbox', { name });
            await field.fill(value);
            await field.press('Tab');
        }
        await page.getByRole('radio', { name: 'Selada' }).click();
        const vb = page.getByRole('textbox', { name: /^Vb/ });
        await vb.fill('60');
        await vb.press('Tab');

        const results = page.locator('[data-region="results"]');
        const proText = await results.innerText();

        await toggle(page).click();
        await expect(advanced(page)).toHaveCount(0);

        expect(await results.innerText()).toBe(proText);
        // O botão recolhido avisa que há campo avançado preenchido (texto, não só cor).
        await expect(
            page.getByRole('button', { name: /Mostrar mais \(1 preenchido\)/ }),
        ).toBeVisible();
    });

    test('gráfico que precisa de campo recolhido oferece "Mostrar campos"', async ({
        page,
    }) => {
        await page.goto('/');
        for (const [name, value] of [
            [/^Fs/, '28'],
            [/^Qts/, '0,38'],
            [/^Vas/, '85'],
        ] as const) {
            const field = page.getByRole('textbox', { name });
            await field.fill(value);
            await field.press('Tab');
        }
        await page.getByRole('radio', { name: 'Selada' }).click();
        const vb = page.getByRole('textbox', { name: /^Vb/ });
        await vb.fill('60');
        await vb.press('Tab');

        await page.getByRole('tab', { name: 'Impedância' }).click();
        await expect(advanced(page)).toHaveCount(0);
        await page.getByRole('button', { name: /^Mostrar campo/ }).click();

        await expect(advanced(page)).toBeVisible();
        await expect(
            page.getByRole('textbox', { name: /^Re\s?—/ }),
        ).toBeVisible();
    });
});

// Idioma com bandeiras (feature 008, US8).
test.describe('idioma com bandeiras', () => {
    test('mostra BR com a bandeira do Brasil e, no menu, as duas bandeiras com o nome por extenso', async ({
        page,
    }) => {
        await page.goto('/');
        const trigger = page.getByRole('button', { name: 'BR — Idioma' });

        await expect(trigger).toHaveText('BR');
        await expect(trigger.locator('svg')).toHaveAttribute(
            'aria-hidden',
            'true',
        );

        await trigger.click();
        const brazil = page.getByRole('menuitemradio', {
            name: 'Português (Brasil)',
        });
        const english = page.getByRole('menuitemradio', { name: 'English' });
        await expect(brazil.locator('svg')).toHaveCount(1);
        await expect(english.locator('svg')).toHaveCount(1);

        await english.click();
        const after = page.getByRole('button', { name: 'EN — Language' });
        await expect(after).toHaveText('EN');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    test('a 360 px, trocar o idioma pelo popover de preferências não perde o valor digitado', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto('/');
        const fs = page.getByRole('textbox', { name: /^Fs/ });
        await fs.fill('28,5');
        await fs.press('Tab');

        await page.getByRole('button', { name: 'Preferências' }).click();
        await page.getByRole('button', { name: 'BR — Idioma' }).click();
        await page.getByRole('menuitemradio', { name: 'English' }).click();

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('textbox', { name: /^Fs/ })).toHaveValue(
            '28.5',
        );
    });
});
