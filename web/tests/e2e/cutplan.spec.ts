import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

function tile(page: Page, label: string) {
    return page
        .locator('[data-region="plan"] span', {
            hasText: new RegExp(`^${label}$`),
        })
        .locator('..');
}

// Driver de referência do quickstart.
async function referenceDriver(page: Page) {
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Qes/, '0,42');
    await fill(page, /^Qms/, '4,1');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Re/, '3,6');
    await fill(page, /^Le/, '2,1');
    await fill(page, /^Xmax/, '14');
    await fill(page, /^Sd/, '491');
}

// O recorte (Ød) também aparece nas dimensões do alto-falante: aqui se edita o do plano.
async function fillPlan(page: Page, name: RegExp, value: string) {
    const field = page
        .locator('[data-region="plan"]')
        .getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

// A folha de impressão também está na página (oculta na tela): os textos se procuram no painel.
function planRegion(page: Page) {
    return page.locator('[data-region="plan"]');
}

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
    await expect(
        page.getByRole('textbox', { name: /Espessura/ }),
    ).toBeVisible();
}

// Caixa selada de 60 L do quickstart: proporção áurea, painel de 18 mm.
test('plano da selada: dimensões, tabela, espessura, proporção e volume em falta', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);

    await expect(tile(page, 'Internas · Largura')).toContainText('391,5');
    await expect(tile(page, 'Internas · Altura')).toContainText('633,4');
    await expect(tile(page, 'Internas · Profundidade')).toContainText('242,0');
    await expect(tile(page, 'Externas · Largura')).toContainText('427,5');
    await expect(tile(page, 'Externas · Altura')).toContainText('669,4');
    await expect(tile(page, 'Externas · Profundidade')).toContainText('278,0');

    const table = page.getByRole('table', { name: /Lista de corte/ });
    await expect(table.getByRole('row')).toHaveCount(6);
    await expect(table.getByRole('row', { name: /Lateral/ })).toContainText(
        '2',
    );
    // O plano fica abaixo dos gráficos, que continuam na tela.
    await expect(page.locator('[data-region="charts"]')).toBeVisible();

    // Espessura maior: o interior se mantém e o exterior cresce.
    await fill(page, /Espessura/, '25');
    await expect(tile(page, 'Internas · Largura')).toContainText('391,5');
    await expect(tile(page, 'Externas · Largura')).toContainText('441,5');

    // Proporção: cúbica deixa os três lados internos iguais.
    await page.getByRole('button', { name: /^(?!Ajuda).*Proporção/ }).click();
    await page.getByRole('option', { name: 'Cúbica' }).click();
    await expect(tile(page, 'Internas · Largura')).toContainText('391,5');
    await expect(tile(page, 'Internas · Altura')).toContainText('391,5');
    await expect(tile(page, 'Internas · Profundidade')).toContainText('391,5');

    // Sem volume não há plano.
    await page
        .locator('[data-region="box"]')
        .getByRole('textbox', { name: /^Vb/ })
        .fill('');
    await page.keyboard.press('Tab');
    await expect(
        planRegion(page).getByText(/Faltam parâmetros para o plano/),
    ).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);

    // Recolher o plano: os gráficos continuam na tela e o conteúdo do plano some.
    await page
        .getByRole('button', { name: 'Plano de corte', exact: true })
        .click();
    await expect(page.locator('[data-region="charts"]')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Espessura/ })).toBeHidden();
});

test('plano da dutada: recorte do driver aparece na frente quando o diâmetro é informado', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '40');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);

    const front = page.getByRole('row', { name: /Frente/ });
    await expect(front).toContainText('diâmetro a informar');
    await expect(front).toContainText('Duto');

    await fillPlan(page, /^Ød/, '285');
    await expect(front).toContainText('Driver');
    await expect(front).not.toContainText('diâmetro a informar');
});

test('conferência: o líquido do plano é o da simulação e os avisos citam a peça', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);

    const check = page.getByRole('table', { name: /Volume por câmara/ });
    await expect(check).toBeVisible();
    await expect(check.getByRole('row', { name: /Dutos/ })).not.toContainText(
        '—',
    );
    await expect(planRegion(page).getByText(/Igual à simulação/)).toBeVisible();

    // O tubo calculado é mais longo que a caixa: o plano pede curva ou dobra.
    await expect(
        planRegion(page).getByText(/precisará de curva ou dobra/),
    ).toBeVisible();

    // Recorte grande demais: erro nomeando a peça, com texto.
    await fillPlan(page, /^Ød/, '700');
    const warnings = page.getByRole('list', { name: 'Avisos do plano' });
    await expect(warnings).toContainText(/não cabe no lado menor de frente/);

    await fillPlan(page, /^Ød/, '285');
    await expect(warnings).not.toContainText(/não cabe no lado menor/);
    await expect(planRegion(page).getByText(/Igual à simulação/)).toBeVisible();
});

test('sem volume o plano diz o que falta e some a conferência', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
    await expect(planRegion(page).getByText(/Igual à simulação/)).toBeVisible();

    await page
        .locator('[data-region="box"]')
        .getByRole('textbox', { name: /^Vb/ })
        .fill('');
    await page.keyboard.press('Tab');
    await expect(
        planRegion(page).getByText(/Faltam parâmetros para o plano/),
    ).toBeVisible();
    await expect(planRegion(page).getByText(/Igual à simulação/)).toHaveCount(
        0,
    );
});

// Bandpass do quickstart: 40 + 60 L, áurea, painel de 18 mm.
test('plano da bandpass: sete peças, divisória, câmaras e conferência por câmara', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();
    await fill(page, /^Vr/, '40');
    await fill(page, /^Vf/, '60');
    await fill(page, /^Fb/, '45');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);
    await fillPlan(page, /^Ød/, '200');

    const parts = page.getByRole('table', { name: /Lista de corte/ });
    await expect(parts.locator('tbody tr')).toHaveCount(6);

    const divider = parts.getByRole('row', { name: /Divisória/ });
    await expect(divider).toContainText('Entre as câmaras');
    await expect(divider).toContainText('Driver');
    await expect(parts.getByRole('row', { name: /Frente/ })).toContainText(
        'Duto',
    );

    await expect(tile(page, 'Profundidade da câmara traseira')).toContainText(
        '114,7',
    );
    await expect(tile(page, 'Profundidade da câmara frontal')).toContainText(
        '172,1',
    );
    await expect(tile(page, 'Internas · Profundidade')).toContainText('286,9');
    await expect(tile(page, 'Externas · Profundidade')).toContainText('340,9');

    const check = page.getByRole('table', { name: /Volume por câmara/ });
    await expect(
        check.getByRole('columnheader', { name: 'Câmara traseira' }),
    ).toBeVisible();
    await expect(
        check.getByRole('columnheader', { name: 'Câmara frontal' }),
    ).toBeVisible();
    await expect(planRegion(page).getByText(/Igual à simulação/)).toBeVisible();

    // Trocar de tipo e voltar não perde a espessura nem a proporção.
    await fill(page, /Espessura/, '25');
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await expect(
        planRegion(page).getByText(/Faltam parâmetros para o plano: .*Vb/),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();
    await expect(parts.locator('tbody tr')).toHaveCount(6);
    await expect(page.getByRole('textbox', { name: /Espessura/ })).toHaveValue(
        /25/,
    );
});

// Bandpass de 6ª ordem: duto frontal na frente, traseiro no fundo.
test('plano da bandpass de 6ª ordem: recortes dos dois dutos e conferência por câmara', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Bandpass 6ª ordem' }).click();

    const chamber = (name: string) =>
        page.getByRole('group', { name, exact: true });
    const inside = async (group: string, field: RegExp, value: string) => {
        const box = chamber(group).getByRole('textbox', { name: field });
        await box.fill(value);
        await box.press('Tab');
    };

    await inside('Câmara traseira (dutada)', /^Vr/, '80');
    await inside('Câmara traseira (dutada)', /^Fbr/, '30');
    await inside('Câmara traseira (dutada)', /Diâmetro/, '80');
    await inside('Câmara frontal (dutada)', /^Vf/, '40');
    await inside('Câmara frontal (dutada)', /^Fb(?!r)/, '45');
    await inside('Câmara frontal (dutada)', /Diâmetro/, '100');
    await openPlan(page);
    await fillPlan(page, /^Ød/, '200');

    const parts = page.getByRole('table', { name: /Lista de corte/ });
    await expect(parts.locator('tbody tr')).toHaveCount(6);
    await expect(parts.getByRole('row', { name: /Frente/ })).toContainText(
        'Duto',
    );
    await expect(parts.getByRole('row', { name: /Fundo/ })).toContainText(
        'Duto',
    );
    await expect(parts.getByRole('row', { name: /Divisória/ })).toContainText(
        'Driver',
    );

    const check = page.getByRole('table', { name: /Volume por câmara/ });
    await expect(
        check.getByRole('columnheader', { name: 'Câmara traseira' }),
    ).toBeVisible();
    await expect(
        check.getByRole('columnheader', { name: 'Câmara frontal' }),
    ).toBeVisible();
    await expect(planRegion(page).getByText(/Igual à simulação/)).toBeVisible();
});

test('desenhos 2D e vista 3D: um desenho por peça, girar por teclado e por botões', async ({
    page,
}) => {
    await page.goto('/');
    await referenceDriver(page);
    await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();
    await fill(page, /^Vr/, '40');
    await fill(page, /^Vf/, '60');
    await fill(page, /^Fb/, '45');
    await fill(page, /Diâmetro do duto/, '100');
    await openPlan(page);
    await fillPlan(page, /^Ød/, '200');

    // Desenhos 2D: um por linha da tabela, e a lista em texto continua inteira.
    await expect(
        page.getByRole('tab', { name: 'Desenhos 2D' }),
    ).toHaveAttribute('aria-selected', 'true');
    const drawings = page.locator(
        '[data-region="plan"] figure svg[role="img"]',
    );
    await expect(drawings).toHaveCount(6);
    await expect(page.getByRole('img', { name: 'Divisória' })).toBeVisible();
    await expect(
        page.getByRole('table', { name: /Lista de corte/ }).locator('tbody tr'),
    ).toHaveCount(6);

    // Vista 3D: carrega ao abrir o modal da caixa e gira.
    await page.getByRole('button', { name: 'Ampliar caixa' }).click();
    const box = page.getByRole('dialog').locator('svg[data-yaw]');
    await expect(box).toBeVisible();
    await expect(box).toHaveAccessibleName(/bandpass.*de largura/);

    const yaw = async () => Number(await box.getAttribute('data-yaw'));
    const start = await yaw();

    await box.focus();
    await page.keyboard.press('ArrowRight');
    expect(await yaw()).toBeGreaterThan(start);

    await page.getByRole('button', { name: 'Girar para a esquerda' }).click();
    await page.getByRole('button', { name: 'Girar para a esquerda' }).click();
    expect(await yaw()).toBeLessThan(start);

    await box.focus();
    await page.keyboard.press('Home');
    expect(await yaw()).toBeCloseTo(start, 3);

    // Por dentro: a divisória aparece.
    await expect(box.locator('[data-id="divider"]')).toHaveCount(0);
    await page.getByText('Ver por dentro').click();
    await expect(box.locator('[data-id="divider"]')).toHaveCount(1);
});

async function downloadCsv(page: Page, button: string) {
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: button }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
    }

    return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

test('exportar CSV: ; e vírgula decimal em pt-BR, vírgula e ponto em en', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
    await fillPlan(page, /^Ød/, '285');

    const pt = await downloadCsv(page, 'Exportar CSV');
    const ptText = pt.bytes.toString('utf8');

    expect(pt.name).toBe('projeto-plano-de-corte.csv');
    expect([...pt.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(ptText).toContain(
        'Peça;Posição;Qtd;Comprimento (mm);Largura (mm);Espessura (mm);Recortes',
    );
    expect(ptText).toContain(
        'Frente;Painel da frente;1;669,4;427,5;18,0;Driver Ø 285,0 mm',
    );
    expect(ptText).toContain('Lateral;Lados esquerdo e direito;2;');

    await page.getByRole('button', { name: /Idioma/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();

    const en = await downloadCsv(page, 'Export CSV');
    const enText = en.bytes.toString('utf8');

    expect(enText).toContain(
        'Piece,Position,Qty,Length (mm),Width (mm),Thickness (mm),Cutouts',
    );
    expect(enText).toContain(
        'Front,Front panel,1,669.4,427.5,18.0,Driver Ø 285.0 mm',
    );
    expect(enText).toContain('Side,Left and right sides,2,');
});

test('imprimir: só a folha do plano fica visível', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
    // A folha só entra na página ao imprimir; o teste troca `print` por um no-op para não abrir o
    // diálogo do navegador e olha a página como o papel a veria.
    await page.evaluate(() => {
        window.print = () => undefined;
    });
    await page.getByRole('button', { name: 'Imprimir' }).click();
    await page.emulateMedia({ media: 'print' });

    const sheet = page.locator('[data-print-sheet]');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Plano de corte:');
    await expect(sheet).toContainText('Lista de corte');
    await expect(sheet).toContainText('Convenção de montagem');
    await expect(page.locator('[data-region="box"]')).toBeHidden();
    await expect(page.locator('[data-region="plan"]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Novo' })).toBeHidden();

    await page.emulateMedia({ media: 'screen' });
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-region="plan"]')).toBeVisible();
});

test('só pelo teclado: seletor de visão, campos, proporção, botões, abas e vista 3D', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');

    // O título do plano abre e fecha a seção por teclado.
    await page
        .getByRole('button', { name: 'Plano de corte', exact: true })
        .focus();
    await page.keyboard.press('Space');
    await expect(
        page.getByRole('textbox', { name: /Espessura/ }),
    ).toBeVisible();

    // Cada campo da configuração tem nome acessível.
    for (const name of [/Espessura/, /Volume dos reforços/, /^Ød/]) {
        await expect(
            planRegion(page).getByRole('textbox', { name }),
        ).toBeVisible();
    }

    // Proporção: Enter abre, setas escolhem, Enter confirma.
    const proportion = page.getByRole('button', {
        name: /^(?!Ajuda).*Proporção/,
    });
    await proportion.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(proportion).not.toContainText('Áurea');

    // Os botões de exportar e imprimir recebem foco.
    for (const name of ['Exportar CSV', 'Imprimir']) {
        const button = page.getByRole('button', { name });
        await button.focus();
        await expect(button).toBeFocused();
    }

    // A vista 3D (no modal da caixa) gira com as setas.
    await page.getByRole('button', { name: 'Ampliar caixa' }).click();
    const box = page.getByRole('dialog').locator('svg[data-yaw]');
    await box.focus();
    const before = Number(await box.getAttribute('data-yaw'));
    await page.keyboard.press('ArrowRight');
    expect(Number(await box.getAttribute('data-yaw'))).toBeGreaterThan(before);

    // Nenhuma armadilha de foco: Tab sai da vista 3D e segue para o resto da página.
    for (let index = 0; index < 20; index += 1) {
        await page.keyboard.press('Tab');
    }

    expect(
        await page.evaluate(
            () => document.activeElement?.closest('svg[data-yaw]') === null,
        ),
    ).toBe(true);
});

// Chapa do usuário e corte total.
test('chapa 2,75 × 1,85 m: visão "Chapas", aproveitamento, total nas duas bases e CSV', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);

    // Corte total com e sem o desconto do MDF, mesmo sem chapa.
    const totals = page.getByRole('table', { name: 'Corte total' });
    await expect(totals).toBeVisible();
    await expect(
        totals.getByRole('row', { name: /Sem desconto do MDF/ }),
    ).toBeVisible();
    await expect(
        totals.getByRole('row', { name: /Com desconto do MDF/ }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Chapas' })).toHaveCount(0);

    await fill(page, /^Wc/, '2750');
    await fill(page, /^Hc/, '1850');
    await page.getByRole('tab', { name: 'Chapas' }).click();

    const region = planRegion(page);
    await expect(region.getByText(/aproveitamento de/).first()).toBeVisible();
    await expect(
        region.getByRole('img', { name: /Chapa 1 com 6 peça\(s\)/ }),
    ).toBeVisible();
    await expect(region.locator('[data-piece]')).toHaveCount(6);

    const csv = (await downloadCsv(page, 'Exportar CSV')).bytes.toString(
        'utf8',
    );
    expect(csv).toContain('Corte total;Peças;Área (cm²);Corte (mm)');
    expect(csv).toContain('Sem desconto do MDF;');
    expect(csv).toContain(
        'Chapas;Chapa;Item do estoque;Peça;Unidade;x (mm);y (mm)',
    );
    expect(csv).toContain('Aproveitamento;');
});

test('chapa pequena avisa as peças que não cabem e a chapa sobrevive ao recarregar', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');
    await openPlan(page);
    await fill(page, /^Wc/, '300');
    await fill(page, /^Hc/, '300');
    await page.getByRole('tab', { name: 'Chapas' }).click();

    await expect(
        planRegion(page).getByText(/Não cabem em nenhuma chapa do estoque:/),
    ).toBeVisible();

    await page.reload();
    await openPlan(page);
    await expect(page.getByRole('textbox', { name: /^Wc/ })).toHaveValue(
        '300,0',
    );
});

test('medidas internas editáveis na Caixa: a altura digitada vale e o plano segue o volume', async ({
    page,
}) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Selada' }).click();
    await fill(page, /^Vb/, '60');

    await expect(page.getByRole('textbox', { name: /^Hi —/ })).toHaveValue(
        '633,4',
    );

    await fill(page, /^Hi —/, '700');
    await expect(page.getByRole('textbox', { name: /^Hi —/ })).toHaveValue(
        '700,0',
    );
    await expect(
        page.getByRole('button', { name: /^(?!Ajuda).*Própria/ }),
    ).toBeVisible();

    await openPlan(page);
    await expect(tile(page, 'Internas · Altura')).toContainText('700,0');
});
