import { SCENE_HEIGHT, SCENE_WIDTH } from './types';

// SVG → PNG no canvas, a 2× por padrão (specs/011, research §7). Só roda no navegador. O SVG como
// imagem não executa script nem carrega recurso externo.
export async function sceneToPng(svg: string, scale = 2): Promise<Blob> {
    const url = URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    );

    try {
        const image = new Image();
        image.src = url;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = SCENE_WIDTH * scale;
        canvas.height = SCENE_HEIGHT * scale;

        const context = canvas.getContext('2d');

        if (context === null) {
            throw new Error('canvas indisponível');
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                (blob) =>
                    blob === null
                        ? reject(new Error('falha ao gerar o PNG'))
                        : resolve(blob),
                'image/png',
            ),
        );
    } finally {
        URL.revokeObjectURL(url);
    }
}
