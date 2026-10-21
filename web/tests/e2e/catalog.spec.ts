import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { json, mockCatalog, SUMMARY } from './catalog-mock';
import type { Handler } from './catalog-mock';

test.use({ viewport: { width: 1440, height: 900 } });

const search = (page: Page) =>
    page.getByRole('combobox', { name: 'Catálogo de drivers' });

test('buscar, escolher e preencher o driver do projeto (US1)', async ({
    page,
}) => {
    await mockCatalog(page);
    await page.goto('/');

    await search(page).fill('tr 6');
    const option = page.getByRole('option', { name: /Triton/ });
    await expect(option).toContainText('Triton TR 620 12" (4 Ω)');
    await expect(option).toContainText('Fs 76,9 Hz · Qts 0,72 · Vas 26,3 L');

    await option.click();

    await expect(page.getByRole('textbox', { name: /^Fs/ })).toHaveValue(
        '76,9',
    );
    await expect(page.getByRole('textbox', { name: /^Qts/ })).toHaveValue(
        '0,72',
    );
    await expect(search(page)).toHaveValue('');

    // O driver já preenche os gráficos: nenhum gráfico pede mais Fs, Qts ou Vas.
    await page.getByRole('button', { name: /^Desfazer/ }).click();
    await expect(page.getByRole('textbox', { name: /^Fs/ })).toHaveValue('');
});

test('duas abas: só o projeto ativo recebe o driver (US1)', async ({
    page,
}) => {
    await mockCatalog(page);
    await page.goto('/');
    await page.keyboard.press('Alt+n');

    await search(page).fill('tr 6');
    await page.getByRole('option', { name: /Triton/ }).click();
    await expect(page.getByRole('textbox', { name: /^Fs/ })).toHaveValue(
        '76,9',
    );

    await page
        .getByRole('navigation', { name: 'Projetos abertos' })
        .getByRole('button')
        .first()
        .click();

    await expect(page.getByRole('textbox', { name: /^Fs/ })).toHaveValue('');
});

const message = 'Não foi possível consultar o catálogo agora';

test('servidor com erro: mensagem, tentar de novo e a bancada segue editável (US2)', async ({
    page,
}) => {
    let failing = true;
    const handler: Handler = (route, url) => {
        if (failing) {
            return json(route, { message: 'erro' }, 500);
        }

        return url.pathname === '/api/drivers/2'
            ? json(route, { data: { ...SUMMARY, source: 'ficha' } })
            : json(route, {
                  data: [SUMMARY],
                  meta: { limit: 20, has_more: false },
              });
    };
    await mockCatalog(page, handler);
    await page.goto('/');

    await search(page).fill('tr 6');
    await expect(page.getByText(message)).toBeVisible();

    // Com o catálogo fora, o resto da bancada continua editável.
    const fs = page.getByRole('textbox', { name: /^Fs/ });
    await fs.fill('28');
    await fs.press('Tab');
    await expect(fs).toHaveValue('28,0');

    failing = false;
    await page.getByRole('button', { name: 'Tentar de novo' }).click();

    await expect(page.getByRole('option', { name: /Triton/ })).toBeVisible();
    await expect(page.getByText(message)).toBeHidden();
});

test('busca sem resultado mostra o termo (US2)', async ({ page }) => {
    await mockCatalog(page, (route) =>
        json(route, { data: [], meta: { limit: 20, has_more: false } }),
    );
    await page.goto('/');

    await search(page).fill('zzzz');

    await expect(
        page.getByText('Nenhum driver encontrado para «zzzz»'),
    ).toBeVisible();
});

test('respostas fora de ordem: só a última digitação aparece (US2)', async ({
    page,
}) => {
    const answer = (model: string, id: number) => ({
        data: [{ ...SUMMARY, id, model }],
        meta: { limit: 20, has_more: false },
    });
    await mockCatalog(page, async (route, url) => {
        const term = url.searchParams.get('q');

        // A busca antiga responde depois da nova.
        if (term === 'tr') {
            await new Promise((resolve) => setTimeout(resolve, 1200));

            return json(route, answer('ANTIGO', 7));
        }

        return json(route, answer('NOVO', 8));
    });
    await page.goto('/');

    await search(page).pressSequentially('tr');
    await page.waitForTimeout(400);
    await search(page).pressSequentially(' 12');

    await expect(page.getByRole('option', { name: /NOVO/ })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('option', { name: /ANTIGO/ })).toHaveCount(0);
    await expect(page.getByRole('option', { name: /NOVO/ })).toBeVisible();
});

test('driver que saiu do catálogo avisa e não muda o projeto (US2)', async ({
    page,
}) => {
    await mockCatalog(page, (route, url) =>
        url.pathname === '/api/drivers/2'
            ? json(route, { message: 'não encontrado' }, 404)
            : json(route, {
                  data: [SUMMARY],
                  meta: { limit: 20, has_more: false },
              }),
    );
    await page.goto('/');

    await search(page).fill('tr 6');
    await page.getByRole('option', { name: /Triton/ }).click();

    await expect(
        page.getByText('Este driver não está mais no catálogo.'),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Fs/ })).toHaveValue('');
});
