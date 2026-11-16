import { measure } from './text';
import type { Primitive, Scene } from './types';

// PDF 1.4 de uma página escrito à mão: fontes padrão Helvetica e
// Helvetica-Bold (não precisam ser embutidas) em WinAnsi, e a cena vira operadores de caminho. O
// texto sai vetorial, nítido ao ampliar. Todo o arquivo é Latin-1: cada caractere é um byte.

export type PdfPage = 'a4' | 'letter';

// Paisagem, em pontos.
const PAGES: Record<PdfPage, [number, number]> = {
    a4: [842, 595],
    letter: [792, 612],
};

// Caracteres do WinAnsi fora do Latin-1 e o byte de cada um.
const CP1252: Record<string, number> = {
    '€': 0x80,
    '…': 0x85,
    '‘': 0x91,
    '’': 0x92,
    '“': 0x93,
    '”': 0x94,
    '•': 0x95,
    '–': 0x96,
    '—': 0x97,
    '™': 0x99,
};

// Círculo por quatro curvas de Bézier.
const KAPPA = 0.5523;

const num = (value: number) => String(Number(value.toFixed(3)));

function color(hex: string, stroke: boolean): string {
    const [r, g, b] = [1, 3, 5].map((start) =>
        num(parseInt(hex.slice(start, start + 2), 16) / 255),
    );

    return `${r} ${g} ${b} ${stroke ? 'RG' : 'rg'}`;
}

function pdfText(value: string): string {
    return Array.from(value, (char) => {
        if (char === '\\' || char === '(' || char === ')') {
            return `\\${char}`;
        }

        const extra = CP1252[char];

        return extra === undefined ? char : String.fromCharCode(extra);
    }).join('');
}

function operators(
    scene: Scene,
    page: [number, number],
    scale: number,
    offset: [number, number],
): string {
    const height = page[1];
    const px = (x: number) => offset[0] + x * scale;
    const py = (y: number) => height - offset[1] - y * scale;
    const out: string[] = [];

    const dash = (values?: number[]) =>
        out.push(
            values === undefined
                ? '[] 0 d'
                : `[${values.map((value) => num(value * scale)).join(' ')}] 0 d`,
        );

    const paint = (fill?: string, stroke?: string, strokeWidth = 1) => {
        const hasFill = fill !== undefined && fill !== 'none';
        const hasStroke = stroke !== undefined && stroke !== 'none';

        if (hasFill) {
            out.push(color(fill, false));
        }

        if (hasStroke) {
            out.push(color(stroke, true), `${num(strokeWidth * scale)} w`);
        }

        return hasFill && hasStroke
            ? 'B'
            : hasFill
              ? 'f'
              : hasStroke
                ? 'S'
                : 'n';
    };

    const draw = (item: Primitive) => {
        switch (item.type) {
            case 'rect': {
                const op = paint(item.fill, item.stroke);

                out.push(
                    `${num(px(item.x))} ${num(py(item.y + item.h))} ${num(item.w * scale)} ${num(item.h * scale)} re`,
                    op,
                );

                return;
            }
            case 'line':
                out.push(
                    color(item.stroke, true),
                    `${num(item.width * scale)} w`,
                );
                dash(item.dash);
                out.push(
                    `${num(px(item.x1))} ${num(py(item.y1))} m`,
                    `${num(px(item.x2))} ${num(py(item.y2))} l`,
                    'S',
                );
                dash();

                return;
            case 'polyline':
                out.push(
                    color(item.stroke, true),
                    `${num(item.width * scale)} w`,
                    '1 j',
                );
                dash(item.dash);
                item.points.forEach(([x, y], index) =>
                    out.push(
                        `${num(px(x))} ${num(py(y))} ${index === 0 ? 'm' : 'l'}`,
                    ),
                );
                out.push('S');
                dash();
                out.push('0 j');

                return;
            case 'circle': {
                const op = paint(item.fill, item.stroke, 1.5);
                const r = item.r * scale;
                const k = r * KAPPA;
                const [cx, cy] = [px(item.cx), py(item.cy)];

                out.push(
                    `${num(cx + r)} ${num(cy)} m`,
                    `${num(cx + r)} ${num(cy + k)} ${num(cx + k)} ${num(cy + r)} ${num(cx)} ${num(cy + r)} c`,
                    `${num(cx - k)} ${num(cy + r)} ${num(cx - r)} ${num(cy + k)} ${num(cx - r)} ${num(cy)} c`,
                    `${num(cx - r)} ${num(cy - k)} ${num(cx - k)} ${num(cy - r)} ${num(cx)} ${num(cy - r)} c`,
                    `${num(cx + k)} ${num(cy - r)} ${num(cx + r)} ${num(cy - k)} ${num(cx + r)} ${num(cy)} c`,
                    op,
                );

                return;
            }
            case 'text': {
                // O rotate do SVG é horário na tela; no PDF (y para cima) o ângulo é o oposto.
                const angle = (-(item.rotate ?? 0) * Math.PI) / 180;
                const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
                const along = measure(item.text, item.size, item.bold) * scale;
                const shift =
                    item.anchor === 'middle'
                        ? along / 2
                        : item.anchor === 'end'
                          ? along
                          : 0;
                const [x, y] = [
                    px(item.x) - shift * cos,
                    py(item.y) - shift * sin,
                ];

                out.push(
                    color(item.color, false),
                    'BT',
                    `/${item.bold === true ? 'F2' : 'F1'} ${num(item.size * scale)} Tf`,
                    `${num(cos)} ${num(sin)} ${num(-sin)} ${num(cos)} ${num(x)} ${num(y)} Tm`,
                    `(${pdfText(item.text)}) Tj`,
                    'ET',
                );
            }
        }
    };

    scene.items.forEach(draw);

    return out.join('\n') + '\n';
}

// Cena → PDF de uma página. A cena é escalada para caber na página (sem distorcer) e centralizada.
export function sceneToPdf(scene: Scene, page: PdfPage): Uint8Array {
    const size = PAGES[page];
    const scale = Math.min(size[0] / scene.width, size[1] / scene.height);
    const offset: [number, number] = [
        (size[0] - scene.width * scale) / 2,
        (size[1] - scene.height * scale) / 2,
    ];
    const content = operators(scene, size, scale, offset);
    const font = (name: string) =>
        `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size[0]} ${size[1]}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
        `<< /Length ${content.length} >>\nstream\n${content}endstream`,
        font('Helvetica'),
        font('Helvetica-Bold'),
    ];

    let file = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets = objects.map((body, index) => {
        const at = file.length;

        file += `${index + 1} 0 obj\n${body}\nendobj\n`;

        return at;
    });
    const xref = file.length;

    file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((at) => {
        file += `${String(at).padStart(10, '0')} 00000 n \n`;
    });
    file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    return Uint8Array.from(file, (char) => char.charCodeAt(0));
}
