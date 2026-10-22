import { expect, test } from '@playwright/test';

for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 640 },
    { width: 390, height: 800 },
]) {
    test(`o modal da caixa não muda de tamanho ao trocar o tipo (${viewport.width}x${viewport.height})`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await page.getByRole('button', { name: 'Ampliar caixa' }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const sizes = new Set<string>();

        for (const name of [
            'Selada',
            'Dutada',
            'Bandpass 4ª ordem',
            'Bandpass 6ª ordem',
        ]) {
            await dialog.getByRole('radio', { name }).click();
            await expect(dialog.getByRole('radio', { name })).toBeChecked();
            // Deixa a animação de troca dos campos terminar antes de medir.
            await page.waitForTimeout(400);

            const box = await dialog.boundingBox();
            sizes.add(
                `${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}@${Math.round(box?.y ?? 0)}`,
            );
        }

        expect(sizes.size).toBe(1);
    });
}
