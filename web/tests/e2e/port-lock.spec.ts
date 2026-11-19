import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

async function fill(page: Page, name: RegExp, value: string) {
    const field = page.getByRole('textbox', { name }).first();
    await field.fill(value);
    await field.press('Tab');
}

const value = (page: Page, name: RegExp) =>
    page.getByRole('textbox', { name }).first();

// Fb, comprimento do duto e volume líquido respondem a cada campo, com a trava escolhendo qual dos
// dois (Fb ou comprimento) fica fixo — como no BassBox e no WinISD.
test('duto: trava na Fb ou no comprimento e volume líquido sempre atualizado', async ({
    page,
}) => {
    await page.goto('/');
    for (const [name, v] of [
        [/^Fs/, '28'],
        [/^Qts/, '0,38'],
        [/^Vas/, '85'],
    ] as const) {
        await fill(page, name, v);
    }
    await page.getByRole('radio', { name: 'Dutada' }).click();
    await fill(page, /^Vb/, '60');
    await fill(page, /^Fb/, '32');

    const net = page
        .getByText(/^Volume líquido/)
        .first()
        .locator('..');
    const lockFb = page.getByRole('radio', { name: 'Travar a sintonia (Fb)' });
    const lockLength = page.getByRole('radio', {
        name: 'Travar o comprimento do duto',
    });

    // Trava na Fb: mudar o diâmetro mantém a Fb e muda o comprimento e o líquido.
    await expect(lockFb).toBeChecked();
    await expect(value(page, /^Lv/)).toHaveValue('325,2');
    await expect(net).toContainText('57,4');
    await fill(page, /^Ø — Diâmetro do duto/, '120');
    await expect(value(page, /^Fb/)).toHaveValue('32,0');
    await expect(value(page, /^Lv/)).toHaveValue('521,3');
    await expect(net).toContainText('54,1');

    // Digitar o comprimento trava nele: a Fb passa a sair do comprimento.
    await fill(page, /^Lv/, '400');
    await expect(lockLength).toBeChecked();
    await expect(value(page, /^Fb/)).not.toHaveValue('32,0');
    const before = await value(page, /^Fb/).inputValue();
    await fill(page, /^Vb/, '50');
    await expect(value(page, /^Lv/)).toHaveValue('400,0');
    await expect(value(page, /^Fb/)).not.toHaveValue(before);

    // Digitar a Fb volta a trava para ela, e o comprimento se recalcula.
    await fill(page, /^Fb/, '35');
    await expect(lockFb).toBeChecked();
    await expect(value(page, /^Fb/)).toHaveValue('35,0');
    await expect(value(page, /^Lv/)).not.toHaveValue('400,0');
});
