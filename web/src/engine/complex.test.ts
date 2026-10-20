import { describe, expect, test } from 'vite-plus/test';
import {
    abs,
    add,
    arg,
    complex,
    div,
    inv,
    mul,
    parallel,
    scale,
    sub,
} from './complex';

describe('complex', () => {
    const a = complex(3, 4);
    const b = complex(1, -2);

    test('soma, subtração, escala e produto', () => {
        expect(add(a, b)).toEqual(complex(4, 2));
        expect(sub(a, b)).toEqual(complex(2, 6));
        expect(scale(a, 2)).toEqual(complex(6, 8));
        expect(mul(a, b)).toEqual(complex(11, -2));
    });

    test('divisão desfaz o produto', () => {
        const back = div(mul(a, b), b);

        expect(back.re).toBeCloseTo(3, 12);
        expect(back.im).toBeCloseTo(4, 12);
    });

    test('módulo, argumento e inverso', () => {
        expect(abs(a)).toBe(5);
        expect(arg(complex(0, 1))).toBeCloseTo(Math.PI / 2, 12);
        expect(abs(mul(a, inv(a)))).toBeCloseTo(1, 12);
    });

    test('paralelo de dois resistores iguais é a metade', () => {
        expect(parallel(complex(8), complex(8)).re).toBeCloseTo(4, 12);
    });
});
