import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
