// Aritmética complexa mínima para resolver o circuito equivalente em cada frequência.
export type Complex = { re: number; im: number };

export function complex(re: number, im = 0): Complex {
    return { re, im };
}

export function add(a: Complex, b: Complex): Complex {
    return { re: a.re + b.re, im: a.im + b.im };
}

export function sub(a: Complex, b: Complex): Complex {
    return { re: a.re - b.re, im: a.im - b.im };
}

export function mul(a: Complex, b: Complex): Complex {
    return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

export function scale(a: Complex, factor: number): Complex {
    return { re: a.re * factor, im: a.im * factor };
}

export function div(a: Complex, b: Complex): Complex {
    const denominator = b.re * b.re + b.im * b.im;

    return {
        re: (a.re * b.re + a.im * b.im) / denominator,
        im: (a.im * b.re - a.re * b.im) / denominator,
    };
}

export function inv(a: Complex): Complex {
    return div(complex(1), a);
}

export function abs(a: Complex): number {
    return Math.hypot(a.re, a.im);
}

export function arg(a: Complex): number {
    return Math.atan2(a.im, a.re);
}

// Associação em paralelo de impedâncias: 1 / (1/a + 1/b).
export function parallel(a: Complex, b: Complex): Complex {
    return inv(add(inv(a), inv(b)));
}
