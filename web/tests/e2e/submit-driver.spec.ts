import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { API, mockCatalog } from './catalog-mock';

test.use({ viewport: { width: 1440, height: 900 } });

const PROTOCOL = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Submitted = Record<string, unknown>;

// O envio simulado pelo contrato (specs/006-enviar-driver-moderacao/contracts/submission-api.md):
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

async function fillProjectDriver(page: Page) {
    await page.getByRole('textbox', { name: /^Fs/ }).fill('34,5');
    await page.getByRole('textbox', { name: /^Qts/ }).fill('0,41');
    await page.getByRole('textbox', { name: /^Vas/ }).fill('85');
    await page.keyboard.press('Tab');
}

test('enviar o driver do projeto: pré-preenchido, protocolo e projeto intacto (US1)', async ({
    page,
}) => {
    await mockCatalog(page);
    const received = await mockSubmission(page);
    await page.goto('/');
    await fillProjectDriver(page);

    await page.getByRole('button', { name: 'Enviar driver' }).click();

    const dialog = page.getByRole('dialog', {
        name: 'Enviar driver ao catálogo',
    });
    await expect(dialog.getByRole('textbox', { name: /^Fs/ })).toHaveValue(
        '34,5',
    );
    await expect(dialog.getByRole('textbox', { name: /^Qts/ })).toHaveValue(
        '0,41',
    );

    await dialog.getByRole('textbox', { name: /Fabricante/ }).fill('Exemplo');
    await dialog.getByRole('textbox', { name: /Modelo/ }).fill('EX-12');
    await dialog
        .getByRole('textbox', { name: /Fonte dos dados/ })
        .fill('Ficha técnica do fabricante');
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
