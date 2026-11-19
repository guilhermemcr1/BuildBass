import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
    driverAction,
    json,
    mockCatalog,
    ok,
    openPicker,
} from './catalog-mock';
import { DEV_ORIGIN, normalMode } from './storage';

// Roda no projeto "dev" (servidor de desenvolvimento), único lugar onde /dev/ui existe.
for (const theme of ['light', 'dark'] as const) {
    for (const path of ['/', '/dev/ui']) {
        test(`sem violações WCAG AA em ${path} no tema ${theme}`, async ({
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

test('todo controle da bancada recebe foco visível só com Tab', async ({
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
                // A caixa do campo acende a borda com o foco dentro dela.
                border:
                    element.closest(
                        '.focus-within\\:border-accent, .group-focus-within\\:border-accent',
                    ) !== null,
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
    // Diálogos e popovers entram com fade: o contraste só vale com a opacidade final. Terminar as
    // animações finitas na hora é determinístico (esperar `finished` trava em páginas em segundo
    // plano, quando os testes rodam em paralelo); as infinitas (ícone girando) ficam como estão.
    await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
            if (animation.effect?.getComputedTiming().iterations !== Infinity) {
                animation.finish();
            }
        }
    });

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

// Bancada com dados: dois projetos plotados, avisos, tabela, gráfico e diálogos.
for (const theme of ['light', 'dark'] as const) {
    test(`bancada com 2 projetos e diálogos sem violações no tema ${theme}`, async ({
        browser,
    }) => {
        // Várias passadas do axe com dois projetos: ~22 s sozinho, passa de 30 s em paralelo.
        test.slow();
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
        // O diálogo sai com fade: espera sumir antes de procurar os botões da barra.
        await expect(page.getByRole('dialog')).toBeHidden();

        await page
            .getByRole('button', { name: /^Fechar Projeto sem nome 2/ })
            .click();
        await expect(
            page.getByRole('dialog', { name: 'Fechar projeto?' }),
        ).toBeVisible();
        expect(await axe(page)).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();

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

// Catálogo de drivers: lista aberta, estado vazio e estado de erro.
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
            page.getByText('Nenhum alto-falante encontrado para “zzzz”'),
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

// Caixa bandpass completa: região da caixa, resultados e gráfico preenchidos.
for (const theme of ['light', 'dark'] as const) {
    test(`sem violações WCAG AA com a bandpass completa no tema ${theme}`, async ({
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

// Plano de corte: selada pronta, bandpass pronta com os desenhos e plano bloqueado.
for (const theme of ['light', 'dark'] as const) {
    for (const state of ['selada', 'bandpass', 'bloqueado'] as const) {
        test(`sem violações WCAG AA no plano de corte (${state}) no tema ${theme}`, async ({
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

            await page
                .getByRole('button', { name: 'Plano de corte', exact: true })
                .click();
            await expect(page.locator('[data-region="plan"]')).toBeVisible();

            if (state !== 'bloqueado') {
                const cutout = page
                    .locator('[data-region="plan"]')
                    .getByRole('textbox', { name: /^Ød/ });
                await cutout.fill('200');
                await cutout.press('Tab');
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

// Formulário de envio de driver: sem violações AA nos dois temas e uso em
// 360 px sem rolagem horizontal.
for (const theme of ['light', 'dark'] as const) {
    for (const width of [1440, 360]) {
        test(`diálogo de envio de driver sem violações WCAG AA em ${width} px no tema ${theme}`, async ({
            browser,
        }) => {
            const context = await browser.newContext({
                colorScheme: theme,
                viewport: { width, height: 900 },
            });
            const page = await context.newPage();
            await mockCatalog(page);
            await page.goto('/');
            await driverAction(page, 'Enviar alto-falante');
            const dialog = page.getByRole('dialog', {
                name: 'Enviar alto-falante ao catálogo',
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

test('o formulário de envio é operável só pelo teclado e devolve o foco ao botão', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockCatalog(page);
    await page.goto('/');
    // O envio fica no menu "⋯" do Driver: abrir pelo teclado, ir ao último item e confirmar.
    const trigger = page.getByRole('button', {
        name: 'Mais ações do alto-falante',
    });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menu').waitFor();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', {
        name: 'Enviar alto-falante ao catálogo',
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

    // O foco para num campo com ajuda: o 1º Esc fecha o tooltip, o 2º fecha o diálogo.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

// Bandpass de 6ª ordem: região da caixa, resultados e plano de corte.
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
        test(`sem violações WCAG AA na bandpass de 6ª ordem (${view}) no tema ${theme}`, async ({
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
                    .getByRole('button', {
                        name: 'Plano de corte',
                        exact: true,
                    })
                    .click();
                const cutout = page
                    .locator('[data-region="plan"]')
                    .getByRole('textbox', { name: /^Ød/ });
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

test('bandpass de 6ª ordem: a 360 px não rola na horizontal e os dois grupos de duto empilham', async ({
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

test('bandpass de 6ª ordem: todos os campos são alcançáveis só pelo teclado, de trás para a frente', async ({
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

// Modal da caixa: aberto, com o 3D cotado e o alto-falante destacado.
for (const theme of ['light', 'dark'] as const) {
    test(`modal da caixa sem violações WCAG AA no tema ${theme}`, async ({
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

// Plano com a chapa do usuário: total, grupo da chapa e visão "Chapas".
for (const theme of ['light', 'dark'] as const) {
    test(`plano com chapa sem violações WCAG AA no tema ${theme}`, async ({
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
        await page
            .getByRole('button', { name: 'Plano de corte', exact: true })
            .click();
        await fill(page, /^Wc/, '2750');
        await fill(page, /^Hc/, '1850');
        await page.getByRole('tab', { name: 'Chapas' }).click();
        await expect(page.locator('[data-piece]').first()).toBeVisible();

        expect(await axe(page)).toEqual([]);
        await context.close();
    });
}

// Diálogos de alto-falantes salvos: salvar e gerenciar, nos dois temas.
for (const theme of ['light', 'dark'] as const) {
    test(`diálogos de alto-falantes salvos sem violações WCAG AA no tema ${theme}`, async ({
        browser,
    }) => {
        const context = await browser.newContext({
            colorScheme: theme,
            viewport: { width: 1440, height: 900 },
        });
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('main').waitFor();

        await fill(page, /^Fs/, '32');
        await fill(page, /^Qts/, '0,42');
        await fill(page, /^Vas/, '90');

        await driverAction(page, 'Salvar este alto-falante');
        const save = page.getByRole('dialog', { name: 'Salvar alto-falante' });
        await expect(save).toBeVisible();
        await save
            .getByRole('textbox', { name: /^Fabricante/ })
            .fill('Marca X');
        await save.getByRole('textbox', { name: /^Modelo/ }).fill('Sub 12');
        await page.waitForTimeout(300);
        expect(await axe(page)).toEqual([]);

        await save.getByRole('button', { name: 'Salvar' }).click();
        await expect(save).toBeHidden();

        await driverAction(page, 'Meus alto-falantes');
        const manage = page.getByRole('dialog', { name: 'Meus alto-falantes' });
        await expect(manage.getByText('Marca X Sub 12')).toBeVisible();
        await page.waitForTimeout(300);
        expect(await axe(page)).toEqual([]);
        await context.close();
    });
}

// Modo Normal: seções "Mostrar mais" recolhidas e abertas à mão, nos dois temas.
for (const theme of ['light', 'dark'] as const) {
    test(`modo Normal com "Mostrar mais" sem violações WCAG AA no tema ${theme}`, async ({
        browser,
    }) => {
        const context = await browser.newContext({
            colorScheme: theme,
            viewport: { width: 1440, height: 900 },
            storageState: normalMode(DEV_ORIGIN),
        });
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('main').waitFor();
        await page.waitForTimeout(300);

        await expect(page.getByRole('textbox', { name: /^Qes/ })).toHaveCount(
            0,
        );
        expect(await axe(page)).toEqual([]);

        await page.getByRole('button', { name: 'Mostrar mais' }).click();
        await expect(page.getByRole('textbox', { name: /^Qes/ })).toBeVisible();
        await page.waitForTimeout(300);
        expect(await axe(page)).toEqual([]);
        await context.close();
    });
}

// A página de referência (só no servidor de desenvolvimento) mostra os componentes da feature 008.
test('/dev/ui mostra HelpTip, status compacto, cores, bandeiras e "Mostrar mais"', async ({
    page,
}) => {
    await page.goto('/dev/ui');

    await expect(
        page.getByRole('heading', { name: 'Refinamento da bancada' }),
    ).toBeVisible();
    await expect(
        page.getByRole('radiogroup', { name: 'Cor do projeto' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Mostrar (mais|menos)/ }),
    ).toBeVisible();
    await expect(
        page
            .getByRole('heading', { name: 'Refinamento da bancada' })
            .locator('..')
            .locator('svg[aria-hidden="true"]')
            .first(),
    ).toBeVisible();
});

// A 360 px: bancada no modo Normal, modal da caixa, busca e diálogo de salvar.
for (const theme of ['light', 'dark'] as const) {
    test(`a 360 px a bancada e os diálogos novos não têm violações WCAG AA no tema ${theme}`, async ({
        browser,
    }) => {
        const context = await browser.newContext({
            colorScheme: theme,
            viewport: { width: 360, height: 800 },
            storageState: normalMode(DEV_ORIGIN),
        });
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('main').waitFor();
        await page.waitForTimeout(300);
        expect(await axe(page)).toEqual([]);

        await fill(page, /^Fs/, '32');
        await fill(page, /^Qts/, '0,42');
        await fill(page, /^Vas/, '90');

        await page.getByRole('button', { name: 'Ampliar caixa' }).click();
        const box = page.getByRole('dialog', { name: 'Caixa' });
        await expect(box).toBeVisible();
        await page.waitForTimeout(300);
        expect(await axe(page)).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(box).toBeHidden();

        await driverAction(page, 'Salvar este alto-falante');
        const save = page.getByRole('dialog', { name: 'Salvar alto-falante' });
        await expect(save).toBeVisible();
        await page.waitForTimeout(300);
        expect(await axe(page)).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(save).toBeHidden();

        await page.getByRole('button', { name: 'Buscar alto-falante' }).click();
        await expect(
            page.getByRole('searchbox', { name: 'Buscar alto-falante' }),
        ).toBeVisible();
        await page.waitForTimeout(300);
        expect(await axe(page, { listOpen: true })).toEqual([]);

        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await context.close();
    });
}

for (const theme of ['light', 'dark'] as const) {
    test(`o diálogo de exportação do gráfico não tem violações WCAG AA no tema ${theme}`, async ({
        browser,
    }) => {
        const context = await browser.newContext({
            colorScheme: theme,
            viewport: { width: 1440, height: 900 },
        });
        const page = await context.newPage();
        await page.goto('/');

        for (const [name, value] of [
            [/^Fs/, '28'],
            [/^Qts/, '0,38'],
            [/^Vas/, '85'],
            [/^Vb/, '50'],
        ] as const) {
            const field = page.getByRole('textbox', { name });
            await field.fill(value);
            await field.press('Tab');
        }

        await page.getByRole('radio', { name: 'Selada' }).click();
        await page.getByRole('button', { name: 'Exportar gráfico' }).click();
        await page.getByRole('dialog').waitFor();
        await page.waitForTimeout(300);

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
        await context.close();
    });
}

// Plano de corte avançado: estoque com dois itens, tipo de corte, visão "Chapas" e o
// diálogo de posição dos recortes, nos dois temas, em tela larga e a 360 px sem rolagem horizontal.
for (const theme of ['light', 'dark'] as const) {
    for (const width of [1440, 360]) {
        test(`estoque, tipo de corte e posição dos recortes sem violações WCAG AA em ${width} px no tema ${theme}`, async ({
            browser,
        }) => {
            test.slow();
            const context = await browser.newContext({
                colorScheme: theme,
                viewport: { width, height: 900 },
            });
            const page = await context.newPage();
            const plan = page.locator('[data-region="plan"]');
            const overflow = () =>
                page.evaluate(
                    () =>
                        document.documentElement.scrollWidth -
                        document.documentElement.clientWidth,
                );
            const fillPlan = async (name: RegExp, value: string) => {
                const field = plan.getByRole('textbox', { name });
                await field.fill(value);
                await field.press('Tab');
            };

            await page.goto('/');
            await page.locator('main').waitFor();
            await page.getByRole('radio', { name: 'Selada' }).click();
            await fill(page, /^Vb/, '60');
            await page
                .getByRole('button', { name: 'Plano de corte', exact: true })
                .click();
            await fillPlan(/^Ød/, '200');
            await fillPlan(/^Wc/, '2750');
            await fillPlan(/^Hc/, '1850');
            await plan.getByRole('button', { name: 'Adicionar chapa' }).click();
            await fillPlan(/^Item 2:.*Largura da chapa/, '900');
            await fillPlan(/^Item 2:.*Altura da chapa/, '600');

            const more = plan.getByRole('button', { name: /^Mostrar mais/ });
            if ((await more.count()) > 0) {
                await more.click();
            }
            await plan
                .getByRole('radio', { name: 'CNC/tupia (livre)' })
                .click();
            await page.waitForTimeout(300);
            expect(await axe(page)).toEqual([]);
            expect(await overflow()).toBeLessThanOrEqual(0);

            await plan.getByRole('tab', { name: 'Chapas' }).click();
            await expect(plan.locator('[data-piece]').first()).toBeVisible();
            expect(await axe(page)).toEqual([]);

            await plan.getByRole('tab', { name: 'Desenhos 2D' }).click();
            await plan
                .getByRole('button', { name: 'Posicionar recortes de frente' })
                .click();
            const dialog = page.getByRole('dialog', {
                name: 'Posicionar recortes — Frente',
            });
            await expect(dialog).toBeVisible();
            await dialog
                .getByRole('button', { name: /^Alto-falante 1,/ })
                .focus();
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(300);
            expect(await axe(page)).toEqual([]);
            expect(await overflow()).toBeLessThanOrEqual(0);
            await context.close();
        });
    }
}
