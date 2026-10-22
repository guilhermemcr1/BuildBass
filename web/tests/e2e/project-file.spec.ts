import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

async function fillPlan(page: Page, name: RegExp, value: string) {
    const input = page
        .locator('[data-region="plan"]')
        .getByRole('textbox', { name });
    await input.fill(value);
    await input.press('Tab');
}

function field(page: Page, name: RegExp) {
    return page.getByRole('textbox', { name });
}

test('exportar, criar novo e abrir o arquivo reproduz os valores (US3)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');
    await page.getByRole('radio', { name: 'Retangular' }).click();
    await fill(page, /Largura do duto/, '50');
    await fill(page, /Altura do duto/, '300');

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('projeto.buildbass.json');
    const path = await download.path();

    await page.getByRole('button', { name: 'Novo' }).click();
    await expect(field(page, /^Fs/)).toHaveValue('');

    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (await choosing).setFiles(path);

    await expect(field(page, /^Fs/)).toHaveValue('28,0');
    await expect(field(page, /^Vas/)).toHaveValue('85,0');
    await expect(field(page, /^Vb/)).toHaveValue('60,0');
    await expect(field(page, /^Fb/)).toHaveValue('32,0');
    await expect(field(page, /Altura do duto/)).toHaveValue('300,0');
});

test('arquivo inválido mostra o motivo e não mexe no projeto (US3)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '31');

    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (
        await choosing
    ).setFiles({
        name: 'quebrado.buildbass.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ isto não é json'),
    });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('O arquivo não é um JSON válido.');
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(field(page, /^Fs/)).toHaveValue('31,0');
});

test('desfazer, refazer e recarregar (US3)', async ({ page }) => {
    await page.goto('/');
    await fill(page, /^Vb/, '50');
    // Edições a menos de 400 ms viram um passo só (arrastar o slider); aqui são dois passos.
    await page.waitForTimeout(500);
    await fill(page, /^Vb/, '70');

    // Fora dos campos, para o atalho não ser o desfazer do próprio texto.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(field(page, /^Vb/)).toHaveValue('50,0');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(field(page, /^Vb/)).toHaveValue('70,0');

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(field(page, /^Vb/)).toHaveValue('50,0');

    await page.reload();
    await expect(field(page, /^Vb/)).toHaveValue('50,0');
});

async function exportedFile(page: Page) {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const path = await (await downloading).path();

    return (await import('node:fs/promises')).readFile(path, 'utf8');
}

test('bandpass exportada grava a versão 5 e reabre igual (feature 004, US4; 008)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();
    await fill(page, /^Vr/, '40');
    await fill(page, /^Vf/, '60');
    await fill(page, /^Fb/, '45');

    const text = await exportedFile(page);
    const file = JSON.parse(text);
    expect(file.version).toBe(5); // a cor do projeto sempre vai (feature 008)
    expect(file.project.box).toMatchObject({
        type: 'bandpass',
        vr_m3: 0.04,
        vf_m3: 0.06,
        fb_hz: 45,
    });

    await page.getByRole('button', { name: 'Novo' }).click();
    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (
        await choosing
    ).setFiles({
        name: 'bandpass.buildbass.json',
        mimeType: 'application/json',
        buffer: Buffer.from(text),
    });

    await expect(
        page.getByRole('radio', { name: 'Bandpass 4ª ordem' }),
    ).toBeChecked();
    await expect(field(page, /^Vr/)).toHaveValue('40,0');
    await expect(field(page, /^Vf/)).toHaveValue('60,0');
    await expect(field(page, /^Fb/)).toHaveValue('45,0');
});

test('caixa dutada exporta a versão 5 com a cor do projeto (feature 004, US4; 008)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');

    const file = JSON.parse(await exportedFile(page));

    expect(file.version).toBe(5);
});

test('arquivo de versão futura mostra a mensagem de app mais novo (feature 004, US4)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '31');

    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (
        await choosing
    ).setFiles({
        name: 'futuro.buildbass.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
            JSON.stringify({
                format: 'buildbass.project',
                version: 7,
                project: {},
            }),
        ),
    });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('versão mais nova do BuildBass');
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(field(page, /^Fs/)).toHaveValue('31,0');
});

test('trocar para bandpass leva o Vb digitado às duas câmaras (feature 004, US4)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Vb/, '50');
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();

    await expect(field(page, /^Vr/)).toHaveValue('50,0');
    await expect(field(page, /^Vf/)).toHaveValue('50,0');
});

async function openPlan(page: Page) {
    const toggle = page.getByRole('button', {
        name: 'Plano de corte',
        exact: true,
    });

    // Aberto uma vez, o plano segue aberto ao trocar de projeto.
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
        await toggle.click();
    }

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function openFile(page: Page, name: string, text: string) {
    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (
        await choosing
    ).setFiles({
        name,
        mimeType: 'application/json',
        buffer: Buffer.from(text),
    });
}

test('plano de corte: ver não muda o arquivo; editar grava a versão 3 e reabre igual (feature 005, US6)', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);

    // Só ver o plano deixa o arquivo sem cutPlan.
    const untouched = JSON.parse(await exportedFile(page));
    expect(untouched.version).toBe(5);
    expect(untouched.project).not.toHaveProperty('cutPlan');

    await fill(page, /Espessura/, '25');
    await page.getByRole('button', { name: /^(?!Ajuda).*Proporção/ }).click();
    await page.getByRole('option', { name: 'Louden' }).click();
    await fill(page, /Volume dos reforços/, '2');
    await fillPlan(page, /^Ød/, '285');

    const text = await exportedFile(page);
    const file = JSON.parse(text);
    expect(file.version).toBe(5);
    expect(file.project.cutPlan).toMatchObject({
        thickness_m: 0.025,
        proportion: 'louden',
        braces_m3: 0.002,
    });
    // A conversão mm → m deixa o ruído de ponto flutuante de qualquer outro campo.
    expect(file.project.cutPlan.cutout_m).toBeCloseTo(0.285, 12);

    await page.getByRole('button', { name: 'Novo' }).click();
    await openFile(page, 'plano.buildbass.json', text);

    await openPlan(page);
    await expect(field(page, /Espessura/)).toHaveValue('25,0');
    await expect(field(page, /Volume dos reforços/)).toHaveValue('2,0');
    await expect(
        page
            .locator('[data-region="plan"]')
            .getByRole('textbox', { name: /^Ød/ }),
    ).toHaveValue('285,0');
    // A proporção reaberta é a Louden: o seletor da Caixa mostra o nome.
    await expect(
        page.getByRole('button', { name: /^(?!Ajuda).*Louden/ }),
    ).toBeVisible();
});

test('plano de corte: arquivo de versão 5 pede atualizar e valor fora da faixa cita o caminho (feature 005, US6)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '31');

    await openFile(
        page,
        'futuro.buildbass.json',
        JSON.stringify({
            format: 'buildbass.project',
            version: 7,
            project: {},
        }),
    );
    let dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('versão mais nova do BuildBass');
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();

    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
    await fill(page, /Espessura/, '25');
    const good = JSON.parse(await exportedFile(page));
    good.project.cutPlan.thickness_m = 0;

    await openFile(page, 'ruim.buildbass.json', JSON.stringify(good));
    dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('project.cutPlan.thickness_m');
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(field(page, /^Fs/)).toHaveValue('31,0');
});

test('plano de corte: desfazer e refazer a edição da espessura (feature 005, US6)', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
    await page.waitForTimeout(500);
    await fill(page, /Espessura/, '25');

    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(field(page, /Espessura/)).toHaveValue('18,0');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(field(page, /Espessura/)).toHaveValue('25,0');
});

test('bandpass de 6ª ordem grava a versão 4 e reabre igual, com os dois dutos (feature 007, US4)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await page.getByRole('radio', { name: 'Bandpass 6ª ordem' }).click();

    const rear = page.getByRole('group', {
        name: 'Câmara traseira (dutada)',
        exact: true,
    });
    const front = page.getByRole('group', {
        name: 'Câmara frontal (dutada)',
        exact: true,
    });
    const inside = async (
        chamber: typeof rear,
        name: RegExp,
        value: string,
    ) => {
        const box = chamber.getByRole('textbox', { name });
        await box.fill(value);
        await box.press('Tab');
    };

    await inside(rear, /^Vr/, '80');
    await inside(rear, /^Fbr/, '30');
    await inside(rear, /Diâmetro/, '80');
    await inside(front, /^Vf/, '40');
    await inside(front, /^Fb(?!r)/, '45');
    await inside(front, /Diâmetro/, '100');

    const text = await exportedFile(page);
    const file = JSON.parse(text);
    expect(file.version).toBe(5);
    expect(file.project.box).toMatchObject({
        type: 'bandpass6',
        vr_m3: 0.08,
        vf_m3: 0.04,
        fb_hz: 45,
        fb_rear_hz: 30,
        port: { shape: 'round', count: 1 },
        port_rear: { shape: 'round', count: 1 },
    });
    expect(file.project.box.port.diameter_m).toBeCloseTo(0.1, 12);
    expect(file.project.box.port_rear.diameter_m).toBeCloseTo(0.08, 12);

    await page.getByRole('button', { name: 'Novo' }).click();
    await openFile(page, 'bandpass6.buildbass.json', text);

    await expect(
        page.getByRole('radio', { name: 'Bandpass 6ª ordem' }),
    ).toBeChecked();
    await expect(rear.getByRole('textbox', { name: /^Fbr/ })).toHaveValue(
        '30,0',
    );
    await expect(rear.getByRole('textbox', { name: /Diâmetro/ })).toHaveValue(
        '80,0',
    );
    await expect(front.getByRole('textbox', { name: /Diâmetro/ })).toHaveValue(
        '100,0',
    );
    await expect(page.locator('[data-region="charts"] canvas')).toBeVisible();
});

const OLD_PROJECT = {
    name: 'antigo',
    driver: { fs_hz: 28, qts: 0.38, vas_m3: 0.085 },
    drivers: { count: 1, wiring: 'parallel' },
    box: {
        type: 'bandpass',
        vr_m3: 0.04,
        vf_m3: 0.06,
        ql: 7,
        fb_hz: 45,
        port: { shape: 'round', diameter_m: 0.1, count: 1 },
    },
    signal: { mode: 'power', power_w: 1, radiation: 'half' },
    fieldUnits: {},
};

for (const [version, extra] of [
    [2, {}],
    [3, { cutPlan: { thickness_m: 0.02, proportion: 'louden' } }],
] as const) {
    test(`abre um arquivo existente de versão ${version} sem mudança (feature 007, US4)`, async ({
        page,
    }) => {
        await page.goto('/');
        await openFile(
            page,
            `v${version}.buildbass.json`,
            JSON.stringify({
                format: 'buildbass.project',
                version,
                project: { ...OLD_PROJECT, ...extra },
            }),
        );

        await expect(
            page.getByRole('radio', { name: 'Bandpass 4ª ordem' }),
        ).toBeChecked();
        await expect(field(page, /^Vr/)).toHaveValue('40,0');
        await expect(field(page, /^Vf/)).toHaveValue('60,0');
    });
}

test('a cor do projeto vai no arquivo e volta ao reabrir (feature 008, US2)', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '31');

    const file = JSON.parse(await exportedFile(page));

    expect(file.version).toBe(5);
    expect(file.color).toBe(1);
    expect(file.project).not.toHaveProperty('color');

    await openFile(
        page,
        'cor.buildbass.json',
        JSON.stringify({ ...file, color: 4 }),
    );
    const reopened = JSON.parse(await exportedFile(page));

    expect(reopened.color).toBe(4);
});

test('dimensões do alto-falante: formato e medidas valem no plano e voltam do arquivo', async ({
    page,
}) => {
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Vb/, '60');

    // No modo Pro a seção já abre sozinha.
    const dims = page.getByRole('button', {
        name: /Dimensões do alto-falante/,
    });
    if ((await dims.getAttribute('aria-expanded')) !== 'true') {
        await dims.click();
    }
    await fill(page, /^A —/, '308');
    await fill(page, /recorte/, '283');
    await fill(page, /^G —/, '160');
    await page.getByRole('button', { name: /Formato/ }).click();
    await page.getByRole('option', { name: 'Retangular' }).click();
    await fill(page, /^D —/, '200');

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const download = await downloading;
    const path = await download.path();
    const saved = JSON.parse(
        await (await import('node:fs/promises')).readFile(path, 'utf8'),
    );

    expect(saved.version).toBe(6);
    expect(saved.project.driverDims).toEqual({
        shape: 'rect',
        a_m: 0.308,
        d_m: 0.2,
        g_m: 0.16,
    });

    await page.getByRole('button', { name: 'Novo' }).click();
    await expect(field(page, /^Fs/)).toHaveValue('');

    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await (await choosing).setFiles(path);

    await expect(field(page, /^A —/)).toHaveValue('308,0');
    await expect(field(page, /^D —/)).toHaveValue('200,0');
    await expect(field(page, /^G —/)).toHaveValue('160,0');
});
