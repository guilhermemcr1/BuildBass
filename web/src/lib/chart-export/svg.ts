import type { Primitive, Scene } from './types';

const ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const dash = (values?: number[]) =>
    values === undefined ? '' : ` stroke-dasharray="${values.join(' ')}"`;

function primitive(item: Primitive): string {
    switch (item.type) {
        case 'rect':
            return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${item.fill ?? 'none'}" stroke="${item.stroke ?? 'none'}"/>`;
        case 'line':
            return `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.stroke}" stroke-width="${item.width}"${dash(item.dash)}/>`;
        case 'polyline':
            return `<polyline points="${item.points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="${item.stroke}" stroke-width="${item.width}" stroke-linejoin="round"${dash(item.dash)}/>`;
        case 'circle':
            return `<circle cx="${item.cx}" cy="${item.cy}" r="${item.r}" fill="${item.fill ?? 'none'}" stroke="${item.stroke ?? 'none'}" stroke-width="1.5"/>`;
        case 'text':
            return `<text x="${item.x}" y="${item.y}" font-size="${item.size}"${item.bold === true ? ' font-weight="bold"' : ''} fill="${item.color}" text-anchor="${item.anchor}"${item.rotate === undefined ? '' : ` transform="rotate(${item.rotate} ${item.x} ${item.y})"`}>${escape(item.text)}</text>`;
    }
}

// Cena → SVG. Sem script, sem imagem e sem referência externa: serve de prévia (<img>) e de
// origem do PNG.
export function sceneToSvg(scene: Scene): string {
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" font-family="Helvetica, Arial, sans-serif">`,
        ...scene.items.map(primitive),
        '</svg>',
    ].join('');
}
