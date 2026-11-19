import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';
import { API, driverAction, mockCatalog } from './catalog-mock';

test.use({ viewport: { width: 1440, height: 900 } });

const PROTOCOL = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Submitted = Record<string, unknown>;

// O envio simulado pelo contrato:
// o servidor real tem os próprios testes (Pest).
async function mockSubmission(
    page: Page,
    respond: (route: Route, body: Submitted) => Promise<void> = (route) =>
        route.fulfill({
            status: 201,
            headers: { ...CORS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: { protocol: PROTOCOL, status: 'pending' },
            }),
        }),
) {
    const received: Submitted[] = [];

    await page.route(`${API}/api/driver-submissions`, async (route) => {
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: CORS });
            return;
        }

        const body = route.request().postDataJSON() as Submitted;
        received.push(body);
        await respond(route, body);
    });

    return received;
}

async function chooseFields(dialog: Locator) {
    await dialog
        .getByRole('button', { name: /Preencher os campos manualmente/ })
        .click();
}

async function fillDialogDriver(dialog: Locator) {
    await dialog.getByRole('textbox', { name: /^Fs/ }).fill('34,5');
    await dialog.getByRole('textbox', { name: /^Qts/ }).fill('0,41');
    await dialog.getByRole('textbox', { name: /^Vas/ }).fill('85');
}

async function fillProjectDriver(page: Page) {
    await page.getByRole('textbox', { name: /^Fs/ }).fill('34,5');
    await page.getByRole('textbox', { name: /^Qts/ }).fill('0,41');
    await page.getByRole('textbox', { name: /^Vas/ }).fill('85');
    await page.keyboard.press('Tab');
}

test('enviar alto-falante: escolha, campos vazios mesmo com driver no projeto, protocolo e projeto intacto', async ({
    page,
}) => {
    await mockCatalog(page);
    const received = await mockSubmission(page);
    await page.goto('/');
    await fillProjectDriver(page);

    await driverAction(page, 'Enviar alto-falante');

    const dialog = page.getByRole('dialog', {
        name: 'Enviar alto-falante ao catálogo',
    });
    // Primeiro a escolha; o formulário não copia o driver do projeto.
    await expect(dialog.getByRole('textbox', { name: /^Fs/ })).toHaveCount(0);
    await chooseFields(dialog);
    await expect(dialog.getByRole('textbox', { name: /^Fs/ })).toHaveValue('');
    await expect(dialog.getByRole('textbox', { name: /^Qts/ })).toHaveValue('');
    await fillDialogDriver(dialog);

    await dialog.getByRole('textbox', { name: /Fabricante/ }).fill('Exemplo');
    await dialog.getByRole('textbox', { name: /Modelo/ }).fill('EX-12');
    await dialog
        .getByRole('textbox', { name: /Fonte dos dados/ })
        .fill('Ficha técnica do fabricante');
    await dialog
        .getByRole('textbox', { name: /E-mail/ })
        .fill('pessoa@exemplo.com');
    await dialog.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText(PROTOCOL)).toBeVisible();
    await expect(page.getByText(/passa por revisão/)).toBeVisible();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
        brand: 'Exemplo',
        model: 'EX-12',
        fs_hz: 34.5,
        qts: 0.41,
        vas_m3: 0.085,
        locale: 'pt-BR',
        website: '',
    });

    await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Fechar', exact: true })
        .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /^Fs/ })).toHaveValue(
        '34,5',
    );
});

test('sem driver no projeto: preencher à mão e enviar', async ({ page }) => {
    await mockCatalog(page);
    const received = await mockSubmission(page);
    await page.goto('/');

    await driverAction(page, 'Enviar alto-falante');
    const dialog = page.getByRole('dialog', {
        name: 'Enviar alto-falante ao catálogo',
    });
    await chooseFields(dialog);
    await expect(dialog.getByRole('textbox', { name: /^Fs/ })).toHaveValue('');

    await dialog.getByRole('textbox', { name: /Fabricante/ }).fill('Exemplo');
    await dialog.getByRole('textbox', { name: /Modelo/ }).fill('EX-12');
    await dialog.getByRole('textbox', { name: /^Fs/ }).fill('40');
    await dialog.getByRole('textbox', { name: /^Qts/ }).fill('0,4');
    await dialog.getByRole('textbox', { name: /^Vas/ }).fill('50');
    await dialog
        .getByRole('textbox', { name: /Fonte dos dados/ })
        .fill('Medição própria');
    await dialog
        .getByRole('textbox', { name: /E-mail/ })
        .fill('pessoa@exemplo.com');
    await dialog.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText(PROTOCOL)).toBeVisible();
    expect(received[0]).toMatchObject({ fs_hz: 40, qts: 0.4, vas_m3: 0.05 });
});

test('falha do servidor: mantém o digitado e o reenvio funciona', async ({
    page,
}) => {
    await mockCatalog(page);
    let attempts = 0;
    await mockSubmission(page, (route) => {
        attempts += 1;

        return attempts === 1
            ? route.fulfill({
                  status: 500,
                  headers: { ...CORS, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: 'x' }),
              })
            : route.fulfill({
                  status: 201,
                  headers: { ...CORS, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      data: { protocol: PROTOCOL, status: 'pending' },
                  }),
              });
    });
    await page.goto('/');

    await driverAction(page, 'Enviar alto-falante');
    const dialog = page.getByRole('dialog', {
        name: 'Enviar alto-falante ao catálogo',
    });
    await chooseFields(dialog);
    await fillDialogDriver(dialog);
    await dialog.getByRole('textbox', { name: /Fabricante/ }).fill('Exemplo');
    await dialog.getByRole('textbox', { name: /Modelo/ }).fill('EX-12');
    await dialog
        .getByRole('textbox', { name: /Fonte dos dados/ })
        .fill('Ficha');
    await dialog
        .getByRole('textbox', { name: /E-mail/ })
        .fill('pessoa@exemplo.com');
    await dialog.getByRole('button', { name: 'Enviar' }).click();

    await expect(dialog.getByRole('alert')).toContainText(
        'não conseguiu receber',
    );
    await expect(
        dialog.getByRole('textbox', { name: /Fabricante/ }),
    ).toHaveValue('Exemplo');
    await expect(dialog.getByRole('textbox', { name: /^Fs/ })).toHaveValue(
        '34,5',
    );

    await dialog.getByRole('button', { name: 'Tentar de novo' }).click();

    await expect(page.getByText(PROTOCOL)).toBeVisible();
    expect(attempts).toBe(2);
});

test('perder a conexão com o diálogo aberto desativa o envio sem perder o digitado', async ({
    page,
    context,
}) => {
    await mockCatalog(page);
    await mockSubmission(page);
    await page.goto('/');

    await driverAction(page, 'Enviar alto-falante');
    const dialog = page.getByRole('dialog', {
        name: 'Enviar alto-falante ao catálogo',
    });
    await chooseFields(dialog);
    await dialog.getByRole('textbox', { name: /Fabricante/ }).fill('Exemplo');

    await context.setOffline(true);

    await expect(dialog.getByRole('button', { name: 'Enviar' })).toBeDisabled({
        timeout: 5000,
    });
    await expect(
        dialog.getByText('Sem conexão: o envio precisa do servidor.'),
    ).toBeVisible();
    await expect(
        dialog.getByRole('textbox', { name: /Fabricante/ }),
    ).toHaveValue('Exemplo');

    await context.setOffline(false);

    await expect(dialog.getByRole('button', { name: 'Enviar' })).toBeEnabled({
        timeout: 8000,
    });
    await expect(
        dialog.getByRole('textbox', { name: /Fabricante/ }),
    ).toHaveValue('Exemplo');
});

test('preencher a partir do manual: preenche os vazios, destaca o suspeito e não envia nada', async ({
    page,
}) => {
    await mockCatalog(page);
    const received = await mockSubmission(page);
    let extractions = 0;

    await page.route(`${API}/api/driver-submissions/extract`, async (route) => {
        extractions += 1;
        await route.fulfill({
            status: 200,
            headers: { ...CORS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: {
                    suggestion: {
                        brand: 'Triton',
                        model: 'TR 620',
                        fs_hz: 76.94,
                        qts: 0.9,
                        qes: 0.779,
                        qms: 8.978,
                        vas_m3: 0.026348,
                    },
                    suspect: ['qts', 'qes', 'qms'],
                    discarded: [],
                    warnings: ['review'],
                },
            }),
        });
    });

    await page.goto('/');
    await driverAction(page, 'Enviar alto-falante');

    const dialog = page.getByRole('dialog', {
        name: 'Enviar alto-falante ao catálogo',
    });

    await dialog.getByRole('button', { name: /Anexar o manual/ }).click();
    await dialog.locator('input[type="file"]').setInputFiles({
        name: 'ficha.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
    });
    await dialog
        .getByRole('button', { name: 'Preencher a partir do manual' })
        .click();

    await expect(
        dialog.getByRole('textbox', { name: /Fabricante/ }),
    ).toHaveValue('Triton');
    await expect(dialog.getByRole('textbox', { name: /^Fs/ })).toHaveValue(
        /^76,9/,
    );
    await expect(
        dialog.getByText(
            'Dados lidos automaticamente. Revise antes de enviar.',
        ),
    ).toBeVisible();
    await expect(
        dialog.getByText(
            'Confira no manual: este valor não bate com os demais.',
        ),
    ).toHaveCount(3);
    expect(extractions).toBe(1);
    expect(received).toHaveLength(0);
});
