import { describe, expect, test, vi } from 'vite-plus/test';
import { exportChart } from './index';
import { buildScene } from './scene';
import { sceneToSvg } from './svg';
import { sceneToPdf } from './pdf';
import { ALL_GROUPS, makeInput } from './test-input';

// O PNG precisa de canvas, que o jsdom não tem.
vi.mock('./raster', () => ({
    sceneToPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const GROUPS = ALL_GROUPS;

describe('exportChart', () => {
    test('PNG: tipo e nome do arquivo', async () => {
        const { blob, fileName } = await exportChart(makeInput(), {
            format: 'png',
            groups: GROUPS,
        });

        expect(blob.type).toBe('image/png');
        expect(fileName).toBe('projeto-a-response-2026-10-23.png');
    });

    test('PDF: tipo, nome, assinatura e página conforme o idioma', async () => {
        const pt = await exportChart(makeInput(), {
            format: 'pdf',
            groups: GROUPS,
        });
        const en = await exportChart(makeInput({ locale: 'en' }), {
            format: 'pdf',
            groups: GROUPS,
        });
        const text = async (blob: Blob) =>
            new TextDecoder('latin1').decode(await blob.arrayBuffer());

        expect(pt.blob.type).toBe('application/pdf');
        expect(pt.fileName).toBe('projeto-a-response-2026-10-23.pdf');
        expect(await text(pt.blob)).toMatch(/^%PDF-/);
        expect(await text(pt.blob)).toContain('/MediaBox [0 0 842 595]');
        expect(await text(en.blob)).toContain('/MediaBox [0 0 792 612]');
    });

    test('o nome do arquivo usa o projeto ativo (o primeiro da lista)', async () => {
        const { fileName } = await exportChart(
            makeInput({
                projects: [
                    { ...makeInput().projects[0], name: 'Caixa Grande' },
                ],
            }),
            { format: 'pdf', groups: GROUPS },
        );

        expect(fileName).toBe('caixa-grande-response-2026-10-23.pdf');
    });
});

describe('SVG e PDF dizem o mesmo (SC-004)', () => {
    test('todo texto da cena está nos dois', () => {
        const scene = buildScene(makeInput(), GROUPS);
        const svg = sceneToSvg(scene);
        const pdf = new TextDecoder('latin1').decode(sceneToPdf(scene, 'a4'));
        const texts = scene.items.flatMap((item) =>
            item.type === 'text' ? [item.text] : [],
        );

        expect(texts.length).toBeGreaterThan(20);
        texts.forEach((text) => {
            const inSvg = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const inPdf = text.replace(/[\\()]/g, (char) => `\\${char}`);

            expect(svg).toContain(`>${inSvg}</text>`);
            expect(pdf).toContain(`(${inPdf}) Tj`);
        });
    });
});
