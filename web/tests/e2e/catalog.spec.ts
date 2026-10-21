import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

// A API é simulada: estes testes provam o front pelo contrato (contracts/catalog-api.md), sem
// precisar de banco. O servidor real tem os próprios testes (Pest) e o quickstart.
const API = 'http://127.0.0.1:8010';
const CORS = { 'Access-Control-Allow-Origin': '*' };

const SUMMARY = {
    id: 2,
    brand: 'Triton',
    model: 'TR 620 12"',
    variant: '4 Ω',
    fs_hz: 76.94,
    qts: 0.717,
    vas_m3: 0.026348,
};

const DRIVER = {
    ...SUMMARY,
    nominal_diameter_m: 0.3048,
    qes: 0.779,
    qms: 8.978,
    re_ohm: 3,
    le_h: 0.000607,
    xmax_m: 0.00635,
    sd_m2: 0.05309,
    pe_w: 620,
    bl_tm: 10.9,
    mms_kg: 0.06392,
    vd_m3: 0.000333,
    source: 'Triton, ficha técnica TR 620 12", jul/2018',
};

function json(route: Route, body: unknown, status = 200) {
    return route.fulfill({
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function mockCatalog(page: Page) {
    await page.route(`${API}/api/drivers**`, (route) => {
        const url = new URL(route.request().url());

        if (url.pathname === '/api/drivers/2') {
            return json(route, { data: DRIVER });
        }

        return json(route, {
            data: [SUMMARY],
            meta: { limit: 20, has_more: false },
        });
    });
}

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
