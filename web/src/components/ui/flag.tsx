import { cn } from '@/lib/utils';

export type FlagCountry = 'br' | 'us';

type FlagProps = {
    country: FlagCountry;
    className?: string;
};

const STRIPES = 13;
const STRIPE_HEIGHT = 14 / STRIPES;
const STARS = Array.from({ length: 12 }, (_, index) => ({
    x: 1.4 + (index % 4) * 1.8 + (Math.floor(index / 4) % 2) * 0.9,
    y: 1.2 + Math.floor(index / 4) * 1.9,
}));

// Bandeiras do Brasil e dos EUA em SVG próprio, só decorativas: o idioma é sempre dito em texto ao
// lado. As cores são os tokens `--flag-*` de app.css, iguais nos dois temas porque são
// cores de identidade. Desenho simplificado para ler bem a 20 px.
export function Flag({ country, className }: FlagProps) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 20 14"
            className={cn(
                'h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-border',
                className,
            )}
        >
            {country === 'br' ? (
                <>
                    <rect width="20" height="14" fill="var(--flag-br-green)" />
                    <polygon
                        points="10,1.6 18.4,7 10,12.4 1.6,7"
                        fill="var(--flag-br-yellow)"
                    />
                    <circle cx="10" cy="7" r="3.2" fill="var(--flag-br-blue)" />
                </>
            ) : (
                <>
                    <rect width="20" height="14" fill="var(--flag-white)" />
                    {Array.from({ length: STRIPES }, (_, index) => index)
                        .filter((index) => index % 2 === 0)
                        .map((index) => (
                            <rect
                                key={index}
                                y={index * STRIPE_HEIGHT}
                                width="20"
                                height={STRIPE_HEIGHT}
                                fill="var(--flag-us-red)"
                            />
                        ))}
                    <rect
                        width="8.4"
                        height={STRIPE_HEIGHT * 7}
                        fill="var(--flag-us-blue)"
                    />
                    {STARS.map((star) => (
                        <circle
                            key={`${star.x}-${star.y}`}
                            cx={star.x}
                            cy={star.y}
                            r="0.38"
                            fill="var(--flag-white)"
                        />
                    ))}
                </>
            )}
        </svg>
    );
}
