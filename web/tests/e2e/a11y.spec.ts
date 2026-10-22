import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { json, mockCatalog, ok, openPicker } from './catalog-mock';

// Roda no projeto "dev" (servidor de desenvolvimento), único lugar onde /dev/ui existe.
for (const theme of ['light', 'dark'] as const) {
    for (const path of ['/', '/dev/ui']) {
        test(`sem violações WCAG AA em ${path} no tema ${theme} (SC-002)`, async ({
            browser,
        }) => {
            const context = await browser.newContext({ colorScheme: theme });
            const page = await context.newPage();
            await page.goto(path);
            await page.locator('main').waitFor();
            await page.waitForTimeout(300);

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            expect(
                results.violations.map((violation) => ({
                    id: violation.id,
                    nodes: violation.nodes.map((node) => node.target.join(' ')),
                })),
            ).toEqual([]);
            await context.close();
        });
    }
}

test('todo controle da bancada recebe foco visível só com Tab (SC-003)', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.locator('main').waitFor();

    const visited = new Set<string>();

    for (let step = 0; step < 60; step++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
            const element = document.activeElement;

            if (element === null || element === document.body) {
                return null;
            }

            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            return {
                // Campos não têm aria-label nem texto: o id (gerado pelo React Aria) os distingue.
                key: `${element.tagName}#${element.id}:${element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30)}`,
                outline:
                    style.outlineStyle !== 'none' &&
                    style.outlineWidth !== '0px',
                ring: style.boxShadow !== 'none',
                border:
                    element.closest('.focus-within\\:border-accent') !== null,
                visible: rect.width > 0 && rect.height > 0,
            };
        });

        if (focused === null) {
            continue;
        }

        expect(focused.visible, focused.key).toBe(true);
        expect(
            focused.outline || focused.ring || focused.border,
            focused.key,
        ).toBe(true);
        visited.add(focused.key);
    }

    expect(visited.size).toBeGreaterThan(20);
});

async function axe(
    page: import('@playwright/test').Page,
    { listOpen = false }: { listOpen?: boolean } = {},
) {
    const builder = new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
    ]);

    // Com a lista do ComboBox aberta, o React Aria esconde o resto da página dos leitores de tela
    // (padrão modal do componente); a lista fecha ao sair do campo com Tab, então nenhum controle
    // fica focado e escondido. O axe acusa isso como aria-hidden-focus só nesse estado.
    const results = await (
        listOpen ? builder.disableRules(['aria-hidden-focus']) : builder
    ).analyze();

    return results.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

async function fill(
    page: import('@playwright/test').Page,
    name: RegExp,
    value: string,
) {
    const field = page.getByRole('textbox', { name });
    await field.fill(value);
    await field.press('Tab');
}

// Bancada com dados: dois projetos plotados, avisos, tabela, gráfico e diálogos (feature 002).
for (const theme of ['light', 'dark'] as const) {
    test(`bancada com 2 projetos e diálogos sem violações no tema ${theme}`, async ({
        browser,
    }) => {
        const context = await browser.newContext({ colorScheme: theme });
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('main').waitFor();

        for (const vb of ['40', '120']) {
            if (vb === '120') {
                await page.getByRole('button', { name: 'Novo' }).click();
            }

            await fill(page, /^Fs/, '28');
            await fill(page, /^Qes/, '0,42');
            await fill(page, /^Qms/, '4,1');
            await fill(page, /^Vas/, '85');
            await fill(page, /^Re/, '3,6');
            await fill(page, /^Sd/, '491');
            await fill(page, /^Xmax/, '14');
            await fill(page, /^Vb/, vb);
            await fill(page, /^Fb/, '32');
        }

        await page.getByRole('tab', { name: 'Excursão' }).click();
        await page.getByRole('group', { name: 'Excursão' }).focus();
        await page.keyboard.press('Home');
        await page.waitForTimeout(300);
        expect(await axe(page)).toEqual([]);

        await page.getByRole('button', { name: 'Novo' }).click();
        await page.getByRole('button', { name: 'Novo' }).click();
        await expect(
            page.getByRole('dialog', { name: 'Limite de projetos abertos' }),
        ).toBeVisible();
        expect(await axe(page)).toEqual([]);
        await page.keyboard.press('Escape');

        await page
            .getByRole('button', { name: /^Fechar Projeto sem nome 2/ })
            .click();
        await expect(
            page.getByRole('dialog', { name: 'Fechar projeto?' }),
        ).toBeVisible();
        expect(await axe(page)).toEqual([]);
        await page.keyboard.press('Escape');

        const choosing = page.waitForEvent('filechooser');
        await page
            .getByRole('button', { name: 'Fechar Projeto sem nome 3' })
            .click();
        await page.getByRole('button', { name: 'Abrir' }).click();
        await (
            await choosing
        ).setFiles({
            name: 'x.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{}'),
        });
        await expect(
            page.getByRole('dialog', {
                name: 'Não foi possível abrir o arquivo',
            }),
        ).toBeVisible();
        expect(await axe(page)).toEqual([]);
        await context.close();
    });
}

test('teclado chega às abas de projeto, aos toggles e ao gráfico', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await fill(page, /^Fs/, '28');
    await fill(page, /^Qts/, '0,38');
    await fill(page, /^Vas/, '85');
    await fill(page, /^Vb/, '50');
    await fill(page, /^Fb/, '30');
    await page.getByRole('button', { name: 'Novo' }).focus();

    const reached = new Set<string>();

    for (let step = 0; step < 120 && reached.size < 3; step++) {
        await page.keyboard.press('Tab');
        const label = await page.evaluate(() => {
            const element = document.activeElement;

            return (
                element?.getAttribute('aria-label') ??
                element?.getAttribute('role') ??
                ''
            );
        });

        for (const target of [
            'Mostrar Projeto sem nome no gráfico',
            'Fechar Projeto sem nome',
            // O gráfico é um grupo com o nome da aba.
            'Resposta',
        ]) {
            if (label === target) {
                reached.add(target);
            }
        }
    }

    expect([...reached].sort()).toEqual(
        [
            'Fechar Projeto sem nome',
            'Mostrar Projeto sem nome no gráfico',
            'Resposta',
        ].sort(),
    );
});

// Catálogo de drivers (feature 003): lista aberta, estado vazio e estado de erro.
for (const theme of ['light', 'dark'] as const) {
    test(`catálogo: lista, vazio e erro sem violações no tema ${theme}`, async ({
        browser,
    }) => {
        const context = await browser.newContext({ colorScheme: theme });
        const page = await context.newPage();
        let mode: 'ok' | 'empty' | 'error' = 'ok';
        await mockCatalog(page, (route, url) => {
            if (mode === 'error') {
                return json(route, { message: 'erro' }, 500);
            }

            return mode === 'empty'
                ? json(route, {
                      data: [],
                      meta: { limit: 20, has_more: false },
                  })
                : ok(route, url);
        });
        await page.goto('/');
        await page.locator('main').waitFor();
        const search = await openPicker(page);

        await search.fill('tr 6');
        await expect(
            page.getByRole('option', { name: /Triton/ }),
        ).toBeVisible();
        expect(await axe(page, { listOpen: true })).toEqual([]);

        mode = 'empty';
        await search.fill('zzzz');
        await expect(
            page.getByText('Nenhum driver encontrado para «zzzz»'),
        ).toBeVisible();
        expect(await axe(page, { listOpen: true })).toEqual([]);

        mode = 'error';
        await search.fill('zzzz1');
        await expect(
            page.getByText('Não foi possível consultar o catálogo agora'),
        ).toBeVisible();
        expect(await axe(page)).toEqual([]);
        await context.close();
    });
}

// Caixa bandpass completa (feature 004): região da caixa, resultados e gráfico preenchidos.
for (const theme of ['light', 'dark'] as const) {
    test(`sem violações WCAG AA com a bandpass completa no tema ${theme} (feature 004, US5)`, async ({
        browser,
    }) => {
        const context = await browser.newContext({
            colorScheme: theme,
            viewport: { width: 1440, height: 900 },
        });
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('main').waitFor();

        const fill = async (name: RegExp, value: string) => {
            const field = page.getByRole('textbox', { name });
            await field.fill(value);
            await field.press('Tab');
        };

        await fill(/^Fs/, '28');
        await fill(/^Qts/, '0,38');
        await fill(/^Qes/, '0,42');
        await fill(/^Qms/, '4,1');
        await fill(/^Vas/, '85');
        await fill(/^Re/, '3,6');
        await fill(/^Sd/, '491');
        await page.getByRole('radio', { name: 'Bandpass 4ª ordem' }).click();
        await fill(/^Vr/, '40');
        await fill(/^Vf/, '60');
        await fill(/^Fb/, '45');
        await fill(/Diâmetro do duto/, '100');
        await expect(
            page.locator('[data-region="charts"] canvas'),
        ).toBeVisible();
        await page.waitForTimeout(300);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

        expect(
            results.violations.map((violation) => ({
                id: violation.id,
                nodes: violation.nodes.map((node) => node.target.join(' ')),
            })),
        ).toEqual([]);
        await context.close();
    });
}

// Plano de corte (feature 005): selada pronta, bandpass pronta com os desenhos e plano bloqueado.
for (const theme of ['light', 'dark'] as const) {
    for (const state of ['selada', 'bandpass', 'bloqueado'] as const) {
        test(`sem violações WCAG AA no plano de corte (${state}) no tema ${theme} (feature 005, US7)`, async ({
            browser,
        }) => {
            const context = await browser.newContext({
                colorScheme: theme,
                viewport: { width: 1440, height: 900 },
            });
            const page = await context.newPage();
            await page.goto('/');
            await page.locator('main').waitFor();

            const fill = async (name: RegExp, value: string) => {
                const field = page.getByRole('textbox', { name });
                await field.fill(value);
                await field.press('Tab');
            };

            await fill(/^Fs/, '28');
            await fill(/^Qts/, '0,38');
            await fill(/^Qes/, '0,42');
            await fill(/^Qms/, '4,1');
            await fill(/^Vas/, '85');
            await fill(/^Re/, '3,6');
            await fill(/^Sd/, '491');

            if (state === 'bandpass') {
                await page
                    .getByRole('radio', { name: 'Bandpass 4ª ordem' })
                    .click();
                await fill(/^Vr/, '40');
                await fill(/^Vf/, '60');
                await fill(/^Fb/, '45');
                await fill(/Diâmetro do duto/, '100');
            } else if (state === 'selada') {
                await page.getByRole('radio', { name: 'Selada' }).click();
                await fill(/^Vb/, '60');
            } else {
                await page.getByRole('radio', { name: 'Selada' }).click();
            }

            await page.getByRole('radio', { name: 'Plano de corte' }).click();
            await expect(page.locator('[data-region="plan"]')).toBeVisible();

            if (state !== 'bloqueado') {
                await fill(/^Ød/, '200');
                await expect(
                    page.getByRole('img', { name: 'Frente' }),
                ).toBeVisible();
            }

            await page.waitForTimeout(300);

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            expect(
                results.violations.map((violation) => ({
                    id: violation.id,
                    nodes: violation.nodes.map((node) => node.target.join(' ')),
                })),
            ).toEqual([]);
            await context.close();
        });
    }
}

// Formulário de envio de driver (specs/006, SC-007): sem violações AA nos dois temas e uso em
// 360 px sem rolagem horizontal.
for (const theme of ['light', 'dark'] as const) {
    for (const width of [1440, 360]) {
        test(`diálogo de envio de driver sem violações WCAG AA em ${width} px no tema ${theme} (SC-007)`, async ({
            browser,
        }) => {
            const context = await browser.newContext({
                colorScheme: theme,
                viewport: { width, height: 900 },
            });
            const page = await context.newPage();
            await mockCatalog(page);
            await page.goto('/');
            await page.getByRole('button', { name: 'Enviar driver' }).click();
            const dialog = page.getByRole('dialog', {
                name: 'Enviar driver ao catálogo',
            });
            await dialog.waitFor();
            await page.waitForTimeout(300);

            // Mostra os erros também: é onde o contraste do vermelho costuma falhar.
            await dialog.getByRole('button', { name: 'Enviar' }).click();
            await dialog.getByRole('alert').waitFor();

            const results = await new AxeBuilder({ page })
                .include('[role="dialog"]')
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            expect(
                results.violations.map((violation) => ({
                    id: violation.id,
                    nodes: violation.nodes.map((node) => node.target.join(' ')),
                })),
            ).toEqual([]);

            const overflow = await dialog.evaluate((element) => ({
                dialog: element.scrollWidth - element.clientWidth,
                page:
                    document.documentElement.scrollWidth -
                    document.documentElement.clientWidth,
            }));
            expect(overflow).toEqual({ dialog: 0, page: 0 });
            await context.close();
        });
    }
}

test('o formulário de envio é operável só pelo teclado e devolve o foco ao botão (SC-007)', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockCatalog(page);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Enviar driver' });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', {
        name: 'Enviar driver ao catálogo',
    });
    await dialog.waitFor();

    // Todo controle do diálogo é alcançado com Tab, e o campo-armadilha nunca recebe foco.
    const reached = new Set<string>();
    for (let step = 0; step < 40; step++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
            const element = document.activeElement;

            return {
                inDialog: element?.closest('[role="dialog"]') !== null,
                trap:
                    element instanceof HTMLInputElement &&
                    element.name === 'website',
                key: `${element?.tagName}#${element?.id}`,
            };
        });
        expect(info.trap).toBe(false);
        expect(info.inDialog).toBe(true);
        reached.add(info.key);
    }
    expect(reached.size).toBeGreaterThan(15);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

// Bandpass de 6ª ordem (feature 007, US6): região da caixa, resultados e plano de corte.
const sixthOrderFields = async (page: Page) => {
    const group = (name: string) =>
        page.getByRole('group', { name, exact: true });
    const fill = async (
        scope: ReturnType<typeof group> | Page,
        name: RegExp,
        value: string,
    ) => {
        const field = scope.getByRole('textbox', { name });
        await field.fill(value);
        await field.press('Tab');
    };

    // O tipo vem antes dos campos: com um campo em foco, a ajuda dele recolhe ao perder o foco e,
    // em 360 px (regiões empilhadas), desloca o seletor entre o toque e a soltura.
    await page.getByRole('radio', { name: 'Bandpass 6ª ordem' }).click();

    for (const [name, value] of [
        [/^Fs/, '28'],
        [/^Qts/, '0,38'],
        [/^Qes/, '0,42'],
        [/^Qms/, '4,1'],
        [/^Vas/, '85'],
        [/^Re/, '3,6'],
        [/^Sd/, '491'],
    ] as const) {
        await fill(page, name, value);
    }

    const rear = group('Câmara traseira (dutada)');
    const front = group('Câmara frontal (dutada)');
    await fill(rear, /^Vr/, '80');
    await fill(rear, /^Fbr/, '30');
    await fill(rear, /Diâmetro/, '80');
    await fill(front, /^Vf/, '40');
    await fill(front, /^Fb(?!r)/, '45');
    await fill(front, /Diâmetro/, '100');

    return { rear, front };
};

for (const theme of ['light', 'dark'] as const) {
    for (const view of ['bancada', 'plano'] as const) {
        test(`sem violações WCAG AA na bandpass de 6ª ordem (${view}) no tema ${theme} (feature 007, US6)`, async ({
            browser,
        }) => {
            const context = await browser.newContext({
                colorScheme: theme,
                viewport: { width: 1440, height: 900 },
            });
            const page = await context.newPage();
            await page.goto('/');
            await page.locator('main').waitFor();
            await sixthOrderFields(page);
            await expect(
                page.locator('[data-region="charts"] canvas'),
            ).toBeVisible();

            if (view === 'plano') {
                await page
                    .getByRole('radio', { name: 'Plano de corte' })
                    .click();
                const cutout = page.getByRole('textbox', { name: /^Ød/ });
                await cutout.fill('200');
                await cutout.press('Tab');
                await expect(
                    page.getByRole('img', { name: 'Fundo' }),
                ).toBeVisible();
            }

            await page.waitForTimeout(300);

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            expect(
                results.violations.map((violation) => ({
                    id: violation.id,
                    nodes: violation.nodes.map((node) => node.target.join(' ')),
                })),
            ).toEqual([]);
            await context.close();
        });
    }
}

test('bandpass de 6ª ordem: a 360 px não rola na horizontal e os dois grupos de duto empilham (feature 007, US6)', async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    const { rear, front } = await sixthOrderFields(page);

    const rearDuct = rear.getByRole('group', {
        name: 'Duto (câmara traseira)',
    });
    const frontDuct = front.getByRole('group', {
        name: 'Duto (câmara frontal)',
    });
    const [a, b] = await Promise.all([
        rearDuct.boundingBox(),
        frontDuct.boundingBox(),
    ]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // Empilhados: o frontal começa abaixo do fim do traseiro.
    expect((b?.y ?? 0) >= (a?.y ?? 0) + (a?.height ?? 0)).toBe(true);

    const overflow = await page.evaluate(
        () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
});

test('bandpass de 6ª ordem: todos os campos são alcançáveis só pelo teclado, de trás para a frente (feature 007, US6)', async ({
    page,
}) => {
    await page.goto('/');
    const { rear, front } = await sixthOrderFields(page);

    const order = [
        rear.getByRole('textbox', { name: /^Vr/ }),
        rear.getByRole('textbox', { name: /^Fbr/ }),
        rear.getByRole('textbox', { name: /Diâmetro/ }),
        rear.getByRole('textbox', { name: /Quantidade de dutos traseiros/ }),
        front.getByRole('textbox', { name: /^Vf/ }),
        front.getByRole('textbox', { name: /^Fb(?!r)/ }),
        front.getByRole('textbox', { name: /Diâmetro/ }),
        front.getByRole('textbox', { name: /Quantidade de dutos/ }),
    ];

    await order[0].focus();

    for (const field of order.slice(1)) {
        let reached = false;

        for (let step = 0; step < 15 && !reached; step += 1) {
            await page.keyboard.press('Tab');
            reached = await field.evaluate(
                (element) => element === document.activeElement,
            );
        }

        expect(reached).toBe(true);
    }
});

// Modal da caixa (feature 008, US4): aberto, com o 3D cotado e o alto-falante destacado.
for (const theme of ['light', 'dark'] as const) {
    test(`modal da caixa sem violações WCAG AA no tema ${theme} (feature 008, US4)`, async ({
        browser,
    }) => {
        const context = await browser.newContext({
            colorScheme: theme,
            viewport: { width: 1440, height: 900 },
        });
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('main').waitFor();

        await fill(page, /^Fs/, '28');
        await fill(page, /^Qts/, '0,38');
        await fill(page, /^Qes/, '0,42');
        await fill(page, /^Qms/, '4,1');
        await fill(page, /^Vas/, '85');
        await fill(page, /^Re/, '3,6');
        await fill(page, /^Sd/, '491');
        await page.getByRole('radio', { name: 'Selada' }).click();
        await fill(page, /^Vb/, '60');

        await page.getByRole('button', { name: 'Ver caixa em 3D' }).click();
        const dialog = page.getByRole('dialog', { name: 'Caixa' });
        await expect(dialog).toBeVisible();
        const cutout = dialog.getByRole('textbox', { name: /^Ød/ });
        await cutout.fill('200');
        await cutout.press('Tab');
        await expect(dialog.locator('[data-part="driver"]')).toHaveCount(1);

        // O modal esconde o resto da página dos leitores de tela, como pede o padrão do componente.
        expect(await axe(page, { listOpen: true })).toEqual([]);
        await context.close();
    });
}
