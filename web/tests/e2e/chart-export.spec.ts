import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

async function setup(page: Page) {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '50');
    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();
}

const exportButton = (page: Page, name = 'Exportar gráfico') =>
    page.getByRole('button', { name });

async function openDialog(page: Page, button = 'Exportar gráfico') {
    await exportButton(page, button).click();
    await expect(page.getByRole('dialog')).toBeVisible();
}

// SVG da prévia, decodificado do data URL da imagem.
async function previewSvg(page: Page): Promise<string> {
    const src = await page
        .getByRole('dialog')
        .getByRole('img')
        .getAttribute('src');

    return decodeURIComponent((src ?? '').slice((src ?? '').indexOf(',') + 1));
}

async function download(page: Page, action: () => Promise<void>) {
    const [file] = await Promise.all([page.waitForEvent('download'), action()]);

    return file;
}

const bytesOf = async (file: Download) => readFileSync((await file.path())!);

test('o botão fica desabilitado sem curva e diz por quê', async ({ page }) => {
    await page.goto('/');

    await expect(exportButton(page)).toBeDisabled();
    await expect(exportButton(page)).toHaveAccessibleDescription(
        'Não há curva para exportar.',
    );
});

test('baixa o PNG da aba aberta, de fundo branco mesmo no tema escuro', async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await setup(page);
    await openDialog(page);

    const file = await download(page, () =>
        page.getByRole('button', { name: 'Baixar' }).click(),
    );
    const bytes = await bytesOf(file);

    expect(file.suggestedFilename()).toMatch(
        /^projeto-sem-nome-response-\d{4}-\d{2}-\d{2}\.png$/,
    );
    expect([...bytes.subarray(0, 8)]).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    // 2× a cena de 1000 × 707.
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
        2000, 1414,
    ]);

    const corner = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);

        return Array.from(context.getImageData(2, 2, 1, 1).data);
    }, bytes.toString('base64'));

    expect(corner).toEqual([255, 255, 255, 255]);
    await expect(page.getByRole('dialog')).toBeHidden();
});

test('a imagem leva a faixa de frequência escolhida', async ({ page }) => {
    await setup(page);
    await page.getByRole('radio', { name: 'Até 200 Hz' }).click();
    await openDialog(page);

    const svg = await previewSvg(page);

    expect(svg).toContain('>200<');
    expect(svg).not.toContain('>500<');
    expect(svg).not.toContain('>1k<');
});

test('os grupos de legenda ligam e desligam, e ficam lembrados', async ({
    page,
}) => {
    await setup(page);
    await openDialog(page);

    let svg = await previewSvg(page);

    expect(svg).toContain('Pico ');
    expect(svg).toContain('F-3 ');
    expect(svg).toContain('Selada');

    await page.getByText('F-3 / F-10').click();
    await page.getByText('Parâmetros da caixa').click();
    svg = await previewSvg(page);

    expect(svg).toContain('Pico ');
    expect(svg).not.toContain('F-3 ');
    expect(svg).not.toContain('Selada');

    await page.getByRole('radio', { name: 'PDF' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await setup(page);
    await openDialog(page);

    await expect(page.getByRole('radio', { name: 'PDF' })).toBeChecked();
    await expect(
        page.getByRole('checkbox', { name: 'F-3 / F-10' }),
    ).not.toBeChecked();
    await expect(
        page.getByRole('checkbox', { name: 'Pico por série' }),
    ).toBeChecked();
});

test('na aba Atraso de grupo F-3/F-10 e limites ficam desabilitados com a razão', async ({
    page,
}) => {
    await setup(page);
    await page.getByRole('tab', { name: 'Atraso de grupo' }).click();
    await openDialog(page);

    await expect(
        page.getByRole('checkbox', { name: 'F-3 / F-10' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('checkbox', { name: 'Limites e alertas' }),
    ).toBeDisabled();
    await expect(
        page.getByText('Só vale no gráfico de Resposta.'),
    ).toBeVisible();
    await expect(
        page.getByRole('checkbox', { name: 'Pico por série' }),
    ).toBeEnabled();
});

test('baixa o PDF de uma página com o mesmo conteúdo', async ({ page }) => {
    await setup(page);
    await openDialog(page);
    await page.getByRole('radio', { name: 'PDF' }).click();

    const file = await download(page, () =>
        page.getByRole('button', { name: 'Baixar' }).click(),
    );
    const pdf = (await bytesOf(file)).toString('latin1');

    expect(file.suggestedFilename()).toMatch(
        /^projeto-sem-nome-response-\d{4}-\d{2}-\d{2}\.pdf$/,
    );
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(1);
    expect(pdf).toContain('/MediaBox [0 0 842 595]');
    expect(pdf).toContain('(Resposta)');
    expect(pdf).toContain('(Projeto sem nome)');
});

test('em inglês a imagem sai em inglês, em Letter', async ({ page }) => {
    await setup(page);
    await page.getByRole('button', { name: /Idioma/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await openDialog(page, 'Export chart');

    const svg = await previewSvg(page);

    expect(svg).toContain('>Response<');
    expect(svg).toContain('>Frequency (Hz)<');
    expect(svg).toContain('Peak ');

    await page.getByRole('radio', { name: 'PDF' }).click();

    const file = await download(page, () =>
        page.getByRole('button', { name: 'Download' }).click(),
    );

    expect((await bytesOf(file)).toString('latin1')).toContain(
        '/MediaBox [0 0 792 612]',
    );
});

test('sem conexão a exportação continua funcionando', async ({
    page,
    context,
}) => {
    await setup(page);
    // Carrega o diálogo (carregado sob demanda) antes de cortar a rede.
    await openDialog(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await context.setOffline(true);
    await openDialog(page);

    const png = await download(page, () =>
        page.getByRole('button', { name: 'Baixar' }).click(),
    );

    expect((await bytesOf(png)).subarray(1, 4).toString()).toBe('PNG');

    await openDialog(page);
    await page.getByRole('radio', { name: 'PDF' }).click();

    const pdf = await download(page, () =>
        page.getByRole('button', { name: 'Baixar' }).click(),
    );

    expect((await bytesOf(pdf)).toString('latin1').startsWith('%PDF-')).toBe(
        true,
    );
    await context.setOffline(false);
});
