import type { Page, Route } from '@playwright/test';

// A API do catálogo simulada nos testes de ponta a ponta: provam o front pelo contrato
// (specs/003-catalogo-de-drivers/contracts/catalog-api.md), sem precisar de banco. O servidor real
// tem os próprios testes (Pest) e o quickstart.
export const API = 'http://127.0.0.1:8010';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export const SUMMARY = {
    id: 2,
    brand: 'Triton',
    model: 'TR 620 12"',
    variant: '4 Ω',
    fs_hz: 76.94,
    qts: 0.717,
    vas_m3: 0.026348,
};

export const DRIVER = {
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

export function json(route: Route, body: unknown, status = 200) {
    return route.fulfill({
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

export type Handler = (route: Route, url: URL) => Promise<void>;

// Resposta padrão: a busca devolve o TR 620 e o detalhe devolve o cadastro completo.
export const ok: Handler = (route, url) => {
    if (url.pathname === '/api/drivers/2') {
        return json(route, { data: DRIVER });
    }

    return json(route, {
        data: [SUMMARY],
        meta: { limit: 20, has_more: false },
    });
};

export async function mockCatalog(page: Page, handler: Handler = ok) {
    await page.route(`${API}/api/drivers**`, (route) =>
        handler(route, new URL(route.request().url())),
    );
}
