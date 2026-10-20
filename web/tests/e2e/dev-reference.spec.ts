import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// Roda contra o preview do build de produção (FR-023).
test('no build de produção /dev/ui mostra a bancada', async ({ page }) => {
    await page.goto('/dev/ui');

    await expect(page.locator('[data-region="driver"]')).toBeVisible();
    await expect(
        page.locator('[data-page="buildbass-ui-reference"]'),
    ).toHaveCount(0);
});

test('o código da página de referência não entra no pacote de produção', () => {
    const assets = join(import.meta.dirname, '../../dist/assets');
    const bundles = readdirSync(assets).filter((file) => file.endsWith('.js'));

    expect(bundles.length).toBeGreaterThan(0);

    for (const file of bundles) {
        expect(
            readFileSync(join(assets, file), 'utf8').includes(
                'buildbass-ui-reference',
            ),
            file,
        ).toBe(false);
    }
});
