import { useLayoutEffect, useRef, useState } from 'react';

export type IndicatorBox = { x: number; y: number; w: number; h: number };

// Mede o item selecionado (`[data-selected]`, que o React Aria põe nas abas e nos botões de
// alternância) para um marcador deslizar de um item ao outro em vez de piscar. Devolve `null`
// até a primeira medida; o marcador nasce já no lugar, sem animar a partir do zero.
export function useIndicator<T extends HTMLElement>(selected: string) {
    const ref = useRef<T>(null);
    const [box, setBox] = useState<IndicatorBox | null>(null);

    useLayoutEffect(() => {
        const root = ref.current;

        if (root === null) {
            return;
        }

        const measure = () => {
            const item = root.querySelector<HTMLElement>('[data-selected]');

            if (item === null) {
                setBox(null);

                return;
            }

            setBox((prev) => {
                const next = {
                    x: item.offsetLeft,
                    y: item.offsetTop,
                    w: item.offsetWidth,
                    h: item.offsetHeight,
                };

                return prev !== null &&
                    prev.x === next.x &&
                    prev.y === next.y &&
                    prev.w === next.w &&
                    prev.h === next.h
                    ? prev
                    : next;
            });
        };

        measure();

        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(measure);

        observer.observe(root);

        return () => observer.disconnect();
    }, [selected]);

    return { ref, box };
}
