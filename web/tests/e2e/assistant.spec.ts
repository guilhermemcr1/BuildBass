import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { API, json, mockCatalog } from './catalog-mock';

// Primeira visita: preferências vazias, o assistente abre sozinho no lugar da bancada.
test.use({ storageState: { cookies: [], origins: [] } });

test('primeira visita: catálogo → caixa → conferência → bancada', async ({
    page,
}) => {
    await mockCatalog(page);
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Qual alto-falante você vai usar?' }),
    ).toBeVisible();
    const next = page.getByRole('button', { name: /Avançar/ });

    // Abre direto no catálogo.
    await page.getByRole('button', { name: /Triton TR 620/ }).click();
    // Escolher no catálogo leva direto à conferência dos dados.
    await expect(page.getByText(/Dados vindos de: Catálogo/)).toBeVisible();
    await expect(
        page.getByText(/Tudo certo: já dá para simular/),
    ).toBeVisible();
    await next.click();

    await expect(
        page.getByRole('heading', { name: 'Como vai ser a caixa?' }),
    ).toBeVisible();
    // Qts 0,717 é alto para o alinhamento clássico: o assistente avisa e a pessoa informa o volume.
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Selada' }).click();
    await page.getByRole('button', { name: 'Usar sugestão clássica' }).click();
    await expect(
        page.getByText(/alto demais para uma sugestão clássica/),
    ).toBeVisible();
    // Avançar sem volume avisa o que falta e leva ao campo.
    await next.click();
    await expect(dialog.getByRole('alert')).toContainText(/para seguir/);
    const vb = dialog.getByRole('textbox', { name: /^Vb/ });
    await expect(vb).toBeFocused();
    await vb.fill('40');
    await vb.press('Tab');
    await next.click();

    await expect(
        page.getByRole('heading', { name: 'Confira o projeto' }),
    ).toBeVisible();
    await expect(page.getByText(/Triton TR 620/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(
        page.getByRole('heading', { name: 'Confira o projeto' }),
    ).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Selada' })).toBeChecked();

    // Já visto: recarregar abre a bancada; o botão da barra traz o assistente de volta.
    await page.reload();
    await expect(
        page.getByRole('button', { name: 'Assistente' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: /assistente/i }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Assistente' }).click();
    await expect(
        page.getByRole('heading', { name: 'Como vai ser a caixa?' }),
    ).toBeVisible();
});

test('texto colado: só as linhas com parâmetro vão ao servidor', async ({
    page,
}) => {
    await mockCatalog(page);
    let sent = '';
    await page.route(
        `${API}/api/driver-submissions/extract-text`,
        async (route) => {
            sent = route.request().postData() ?? '';
            await json(route, {
                data: {
                    suggestion: {
                        brand: 'Marca',
                        model: 'SW12',
                        fs_hz: 32,
                        qts: 0.4,
                        vas_m3: 0.06,
                    },
                    suspect: [],
                    discarded: [],
                    warnings: ['review'],
                },
            });
        },
    );
    await page.goto('/');

    await page.getByRole('button', { name: /^Colar texto/ }).click();
    await page
        .getByRole('textbox', { name: 'Texto com os parâmetros' })
        .fill(
            'Marca SW12\nFs 32 Hz\nQts 0,4\nVas 60 L\nCompre em www.loja.com com desconto hoje',
        );
    await expect(
        page.getByText(/4 linhas com parâmetros serão enviadas; 1 ignorada/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Preencher com IA' }).click();

    await expect(page.getByText(/3 campos preenchidos pela IA/)).toBeVisible();
    expect(sent).toContain('Fs 32 Hz');
    expect(sent).not.toContain('loja.com');
    await expect(
        page.getByText(/Tudo certo: já dá para simular/),
    ).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
    test(`assistente sem violações WCAG AA no tema ${theme}`, async ({
        browser,
    }) => {
        const context = await browser.newContext({
            colorScheme: theme,
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();
        await mockCatalog(page);
        await page.goto('/');
        await page.getByRole('button', { name: /Triton TR 620/ }).waitFor();
        await page.getByRole('button', { name: /^Digitar/ }).waitFor();
        // Espera a entrada escalonada terminar: o axe mede contraste com a opacidade final.
        await page.waitForTimeout(800);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        expect(results.violations).toEqual([]);
        await context.close();
    });
}
