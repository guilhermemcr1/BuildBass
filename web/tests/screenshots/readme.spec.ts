import { expect, test } from '@playwright/test';
import type { Browser, Locator, Page, Route } from '@playwright/test';
import { API, driverAction, json, mockCatalog } from '../e2e/catalog-mock';

// Imagens do README. Cada teste monta um cenário pela interface, como alguém usando o app, e
// salva em `.github/assets/`. Rodar de novo regrava as imagens: `npm run screenshots`.
const OUT = '../.github/assets';
const ORIGIN = 'http://127.0.0.1:4173';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

type Theme = 'dark' | 'light';

function storage(state: Record<string, unknown>) {
    return {
        cookies: [],
        origins: [
            {
                origin: ORIGIN,
                localStorage: [
                    {
                        name: 'buildbass.preferences',
                        value: JSON.stringify({ state, version: 3 }),
                    },
                ],
            },
        ],
    };
}

// Bancada em modo Pro (todos os campos) ou assistente aberto na primeira visita.
const WORKBENCH = storage({ mode: 'pro', assistantSeen: true });
const FIRST_VISIT = storage({ assistantSeen: false });

async function open(
    browser: Browser,
    {
        theme = 'dark',
        viewport = DESKTOP,
        state = WORKBENCH,
    }: {
        theme?: Theme;
        viewport?: { width: number; height: number };
        state?: ReturnType<typeof storage>;
    } = {},
) {
    const context = await browser.newContext({
        colorScheme: theme,
        viewport,
        storageState: state,
        reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    // A API "está no ar": sem isso o app mostra o aviso de sem conexão.
    await page.route(`${API}/up`, (route) =>
        route.fulfill({
            status: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: 'ok',
        }),
    );
    await mockCatalog(page);
    await page.goto('/');

    return { context, page };
}

async function fill(scope: Page | Locator, name: RegExp, value: string) {
    const field = scope.getByRole('textbox', { name }).first();
    await field.fill(value);
    await field.press('Tab');
}

// O 12" do quickstart, numa dutada de 60 L sintonizada em 32 Hz.
async function ventedProject(page: Page, port = '100') {
    await page.locator('main').waitFor();
    const name = page.getByRole('textbox', { name: 'Nome do projeto' });
    await name.fill('Sub 12" dutado');
    await name.press('Enter');
    await fill(page, /^Fabricante/, 'Exemplo');
    await fill(page, /^Modelo/, 'SW 12"');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Qes/, '0,42');
    await fill(page, /^Qms/, '4,1');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Re/, '3,6');
    await fill(page, /^Le —/, '2,1');
    await fill(page, /^Xmax/, '14');
    await fill(page, /^Sd/, '491');
    await fill(page, /^Pe/, '600');
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');
    await fill(page, /Diâmetro do duto/, port);
}

// Preencher rola a lateral; para a foto, tudo volta ao topo.
async function scrollAllToTop(page: Page) {
    await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>('*')) {
            if (element.scrollTop > 0) {
                element.scrollTop = 0;
            }
        }
    });
}

async function shot(page: Page, name: string, fullPage = false) {
    // Sem cursor piscando nem foco pintado no meio da imagem.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

// Manual simulado: o PDF volta como a IA leria a ficha do TR 620.
const MANUAL_READ = {
    data: {
        suggestion: {
            brand: 'Triton',
            model: 'TR 620 12"',
            nominal_diameter_m: 0.3048,
            fs_hz: 76.94,
            qts: 0.717,
            qes: 0.779,
            qms: 8.978,
            vas_m3: 0.026348,
            re_ohm: 3,
            sd_m2: 0.05309,
            xmax_m: 0.00635,
            pe_w: 620,
        },
        suspect: [],
        discarded: [],
        warnings: ['review'],
    },
};

const PDF = {
    name: 'ficha-tecnica-tr620.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
};

for (const theme of ['dark', 'light'] as const) {
    test(`bancada (${theme})`, async ({ browser }) => {
        const { context, page } = await open(browser, { theme });
        await ventedProject(page);
        await scrollAllToTop(page);
        await shot(page, `screenshot-${theme}`);
        await context.close();
    });
}

test('plano de corte', async ({ browser }) => {
    const { context, page } = await open(browser);
    await ventedProject(page);
    const toggle = page.getByRole('button', {
        name: 'Plano de corte',
        exact: true,
    });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
        await toggle.click();
    }
    const cutout = page
        .locator('[data-region="plan"]')
        .getByRole('textbox', { name: /^Ød|recorte/ })
        .first();
    await cutout.fill('282');
    await cutout.press('Tab');
    await scrollAllToTop(page);
    await page.evaluate(() =>
        document
            .querySelector('[data-region="plan"]')
            ?.scrollIntoView({ block: 'start' }),
    );
    await shot(page, 'screenshot-cutplan');
    await context.close();
});

test('caixa em 3D', async ({ browser }) => {
    const { context, page } = await open(browser);
    await ventedProject(page, '75');
    await page.getByRole('button', { name: 'Ver caixa em 3D' }).click();
    const dialog = page.getByRole('dialog', { name: 'Caixa' });
    await expect(dialog).toBeVisible();
    const cutout = dialog.getByRole('textbox', { name: /^Ød/ });
    await cutout.fill('282');
    await cutout.press('Tab');
    await expect(dialog.locator('[data-part="driver"]').first()).toBeVisible();
    // Um pouco de giro para mostrar a lateral com o duto.
    const left = dialog.getByRole('button', { name: 'Girar para a esquerda' });
    await left.click();
    await left.click();
    await shot(page, 'screenshot-box-3d');
    await context.close();
});

test('envio ao catálogo preenchido pelo manual', async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.route(`${API}/api/driver-submissions/extract`, (route) =>
        json(route, {
            data: {
                ...MANUAL_READ.data,
                suggestion: { ...MANUAL_READ.data.suggestion, qts: 0.9 },
                suspect: ['qts'],
            },
        }),
    );
    await page.locator('main').waitFor();
    await driverAction(page, 'Enviar alto-falante');
    const dialog = page.getByRole('dialog', {
        name: 'Enviar alto-falante ao catálogo',
    });
    await dialog.getByRole('button', { name: /Anexar o manual/ }).click();
    await dialog.locator('input[type="file"]').setInputFiles(PDF);
    await dialog
        .getByRole('button', { name: 'Preencher a partir do manual' })
        .click();
    await expect(
        dialog.getByRole('textbox', { name: /Fabricante/ }),
    ).toHaveValue('Triton');
    await shot(page, 'screenshot-submit-filled');
    await context.close();
});

test('assistente: catálogo', async ({ browser }) => {
    const { context, page } = await open(browser, { state: FIRST_VISIT });
    await page.getByRole('button', { name: /Triton TR 620/ }).waitFor();
    await page.getByRole('button', { name: /^Manual/ }).hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/screenshot-assistant-catalog.png` });
    await context.close();
});

test('assistente: manual em PDF lido pela IA', async ({ browser }) => {
    const { context, page } = await open(browser, { state: FIRST_VISIT });
    // A resposta espera a primeira imagem: mostra o "Lendo…" antes do resultado.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(
        `${API}/api/driver-submissions/extract`,
        async (route: Route) => {
            await held;
            await json(route, MANUAL_READ);
        },
    );
    await page.getByRole('button', { name: /^Manual/ }).click();
    await page
        .getByRole('region', { name: 'Manual (PDF)' })
        .locator('input[type="file"]')
        .setInputFiles(PDF);
    // A leitura começa sozinha ao anexar um PDF válido.
    await expect(page.getByText('A IA está lendo o manual…')).toBeVisible();
    await shot(page, 'screenshot-assistant-pdf');

    release();
    await expect(page.getByText(/campos preenchidos pela IA/)).toBeVisible();
    await shot(page, 'screenshot-assistant-pdf-result');
    await context.close();
});

test('assistente: colar texto', async ({ browser }) => {
    const { context, page } = await open(browser, { state: FIRST_VISIT });
    await page.getByRole('button', { name: /^Colar texto/ }).click();
    await page
        .getByRole('textbox', { name: 'Texto com os parâmetros' })
        .fill(
            'Subwoofer SW12 — 12"\nFs 32 Hz\nQts 0,40\nVas 60 L\nRe 3,4 Ω\nXmax 12 mm\nFrete grátis para todo o Brasil!\nCompre em www.loja.com',
        );
    await expect(page.getByText(/serão enviadas/)).toBeVisible();
    await shot(page, 'screenshot-assistant-text');
    await context.close();
});

test('assistente: caixa e conferência', async ({ browser }) => {
    const { context, page } = await open(browser, { state: FIRST_VISIT });
    await page.getByRole('button', { name: /^Digitar/ }).click();
    const dialog = page.getByRole('dialog');
    await fill(dialog, /^Fabricante/, 'Exemplo');
    await fill(dialog, /^Modelo/, 'SW 12"');
    await fill(dialog, /^Fs/, '28');
    await fill(dialog, /^Qts/, '0,38');
    await fill(dialog, /^Vas/, '85');
    await fill(dialog, /^Re/, '3,6');
    await fill(dialog, /^Sd/, '491');
    await fill(dialog, /^Xmax/, '14');
    await fill(dialog, /^Pe/, '600');
    await page.getByRole('button', { name: /Avançar/ }).click();

    await dialog.getByRole('radio', { name: 'Dutada' }).click();
    await page.getByRole('button', { name: 'Usar sugestão clássica' }).click();
    await fill(dialog, /^P —/, '500');
    await dialog.getByText('Que tipo de caixa?').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, 'screenshot-assistant-box');

    await page.getByRole('button', { name: /Avançar/ }).click();
    await expect(
        page.getByRole('heading', { name: 'Confira o projeto' }),
    ).toBeVisible();
    await scrollAllToTop(page);
    await shot(page, 'screenshot-assistant-review');
    await context.close();
});

test('assistente no celular', async ({ browser }) => {
    const { context, page } = await open(browser, {
        state: FIRST_VISIT,
        viewport: MOBILE,
    });
    await page.getByRole('button', { name: /Triton TR 620/ }).waitFor();
    await page.screenshot({ path: `${OUT}/screenshot-assistant-mobile.png` });
    await context.close();
});
