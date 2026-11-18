import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

async function driver(page: Page, vb: string) {
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qes/, '0,42');
    await fill(page, /^Qms/, '4,1');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Re/, '3,6');
    await fill(page, /^Sd/, '491');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, vb);
}

async function rename(page: Page, current: RegExp, next: string) {
    await page.getByRole('button', { name: current }).dblclick();
    const input = page.getByRole('textbox', { name: /^Renomear/ });
    await input.fill(next);
    await input.press('Enter');
}

const tabs = (page: Page) =>
    page.getByRole('navigation', { name: 'Projetos abertos' });

test('dois projetos plotados: legenda, tabela e recarregar', async ({
    page,
}) => {
    await page.goto('/');
    await driver(page, '40');
    await rename(page, /^Projeto sem nome/, 'Pequena');

    await page.getByRole('button', { name: 'Novo' }).click();
    await driver(page, '120');
    await rename(page, /^Projeto sem nome/, 'Grande');

    // O navegador mantém o espaço antes do aviso de não exportado no nome acessível.
    await expect(
        tabs(page).getByRole('button', {
            name: 'Grande (alterações não salvas)',
        }),
    ).toHaveAttribute('aria-current', 'true');

    const legend = page.getByRole('list', { name: 'Projetos no gráfico' });
    await expect(legend).toContainText('Pequena');
    await expect(legend).toContainText('Grande');

    // Com vários projetos a tabela de comparação começa recolhida.
    await page
        .locator('[data-region="results"]')
        .getByRole('button', { name: 'Resultados' })
        .click();
    const table = page.locator('[data-region="results"] table');
    await expect(table.getByRole('columnheader')).toHaveText([
        /^$|Resultados/,
        'Grande',
        'Pequena',
    ]);
    await expect(table.getByRole('row', { name: /^Qtc/ })).not.toContainText(
        '—',
    );

    await tabs(page)
        .getByRole('button', { name: 'Mostrar Pequena no gráfico' })
        .click();
    await expect(table).toHaveCount(0);

    await page.reload();
    await expect(tabs(page).getByRole('listitem')).toHaveCount(2);
    await expect(
        tabs(page).getByRole('button', { name: /^Grande/ }),
    ).toHaveAttribute('aria-current', 'true');
    await expect(
        tabs(page).getByRole('button', { name: 'Mostrar Pequena no gráfico' }),
    ).toHaveAttribute('aria-pressed', 'false');
});

test('fechar alterado pede confirmação e o quarto projeto avisa o limite', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Vb/, '50');

    await tabs(page)
        .getByRole('button', { name: 'Fechar Projeto sem nome' })
        .click();
    const confirm = page.getByRole('dialog', { name: 'Fechar projeto?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('textbox', { name: /^Vb/ })).toHaveValue(
        '50,0',
    );

    await page.getByRole('button', { name: 'Novo' }).click();
    await page.getByRole('button', { name: 'Novo' }).click();
    await page.getByRole('button', { name: 'Novo' }).click();
    const limit = page.getByRole('dialog', {
        name: 'Limite de projetos abertos',
    });
    await expect(limit.getByRole('listitem')).toHaveCount(3);

    // Fechar um projeto sem alterações pelo aviso libera o lugar.
    await limit
        .getByRole('button', { name: 'Fechar Projeto sem nome 3' })
        .click();
    await expect(limit).toBeHidden();
    await expect(tabs(page).getByRole('listitem')).toHaveCount(2);

    await tabs(page)
        .getByRole('button', { name: 'Fechar Projeto sem nome', exact: true })
        .click();
    await confirm.getByRole('button', { name: 'Fechar sem salvar' }).click();
    await expect(tabs(page).getByRole('listitem')).toHaveCount(1);
});
