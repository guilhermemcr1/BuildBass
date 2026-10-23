@php
    /**
     * Esquema do alto-falante em corte (aro, cone ou domo, cesto e ímã) e, ao lado, a vista frontal.
     * Mesma geometria do desenho da bancada (web/src/components/workbench/driver-drawing.tsx).
     * Ao focar um campo de medida, a cota correspondente acende no desenho e a legenda explica.
     *
     * @var string $shape  round|square|rect
     * @var string $piston cone|dome|flat
     * @var array<string, array{letter: string, title: string, text: string}> $dimensions
     */
    // Cotas do corte lateral: [chave, letra, x1, y1, x2, y2, x do texto, y do texto].
    $cuts = [
        ['drv_a_m', 'A', 30, 10, 30, 96, 22, 56],
        ['cutout_m', 'C', 44, 22, 44, 84, 44, 99],
        ['drv_b_m', 'B', 78, 22, 78, 84, 78, 99],
        ['drv_f_m', 'F', 56, 106, 62, 106, 72, 110],
        ['drv_e_m', 'E', 106, 84, 142, 84, 124, 97],
        ['drv_g_m', 'G', 56, 126, 142, 126, 99, 139],
    ];
    $rect = $shape === 'rect';
    $square = $shape === 'square';
@endphp

<div
    x-data="{ active: null }"
    x-on:dim-focus.window="active = $event.detail.key"
    style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%;"
>
    <svg
        role="img"
        aria-label="Esquema do alto-falante em corte, com as medidas A a G"
        viewBox="0 0 274 144"
        style="display: block; width: 100%; max-width: 44rem; height: auto; margin-inline: auto; color: inherit"
    >
        <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" opacity="0.9">
            <rect x="56" y="10" width="6" height="86" />
            <path d="M62 22 L106 40 L106 66 L62 84" />
            <rect x="106" y="34" width="36" height="38" fill="currentColor" fill-opacity="0.08" />
            @if ($piston === 'cone')
                <path d="M62 22 L96 46 L96 60 L62 84" />
            @elseif ($piston === 'dome')
                <path d="M62 22 Q86 53 62 84" />
            @else
                <path d="M66 22 L66 84" />
            @endif

            @if ($shape === 'round')
                <circle cx="206" cy="53" r="38" />
                <circle cx="206" cy="53" r="28" />
                <circle cx="206" cy="53" r="8" />
            @elseif ($square)
                <rect x="168" y="15" width="76" height="76" rx="4" />
                <rect x="178" y="25" width="56" height="56" rx="28" />
            @else
                <rect x="162" y="25" width="88" height="56" rx="4" />
                <rect x="172" y="33" width="68" height="40" rx="20" />
            @endif
        </g>

        @foreach ($cuts as [$key, $letter, $x1, $y1, $x2, $y2, $tx, $ty])
            <g
                fill="none"
                x-bind:stroke-width="active === '{{ $key }}' ? 3 : 1.75"
                x-bind:stroke="active === '{{ $key }}' ? 'var(--primary-500)' : 'var(--gray-400)'"
                x-bind:style="active === '{{ $key }}' ? 'color: var(--primary-500)' : 'color: var(--gray-500)'"
            >
                <line x1="{{ $x1 }}" y1="{{ $y1 }}" x2="{{ $x2 }}" y2="{{ $y2 }}" />
                @if ($x1 === $x2)
                    <line x1="{{ $x1 - 3 }}" y1="{{ $y1 }}" x2="{{ $x1 + 3 }}" y2="{{ $y1 }}" />
                    <line x1="{{ $x2 - 3 }}" y1="{{ $y2 }}" x2="{{ $x2 + 3 }}" y2="{{ $y2 }}" />
                @else
                    <line x1="{{ $x1 }}" y1="{{ $y1 - 3 }}" x2="{{ $x1 }}" y2="{{ $y1 + 3 }}" />
                    <line x1="{{ $x2 }}" y1="{{ $y2 - 3 }}" x2="{{ $x2 }}" y2="{{ $y2 + 3 }}" />
                @endif
                <text x="{{ $tx }}" y="{{ $ty }}" text-anchor="middle" fill="currentColor" stroke="none" font-size="12" font-weight="700">{{ $letter }}</text>
            </g>
        @endforeach

        @if ($rect)
            <g
                fill="none"
                x-bind:stroke-width="active === 'drv_d_m' ? 3 : 1.75"
                x-bind:stroke="active === 'drv_d_m' ? 'var(--primary-500)' : 'var(--gray-400)'"
                x-bind:style="active === 'drv_d_m' ? 'color: var(--primary-500)' : 'color: var(--gray-500)'"
            >
                <line x1="258" y1="25" x2="258" y2="81" />
                <line x1="255" y1="25" x2="261" y2="25" />
                <line x1="255" y1="81" x2="261" y2="81" />
                <text x="268" y="56" text-anchor="middle" fill="currentColor" stroke="none" font-size="12" font-weight="700">D</text>
            </g>
        @endif

        <text x="99" y="6" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.65">corte lateral</text>
        <text x="206" y="104" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.65">vista frontal</text>
    </svg>

    <p
        aria-live="polite"
        style="min-height: 4.5rem; margin: 0; padding: 0.75rem 1rem; border: 1px solid color-mix(in oklab, currentColor 18%, transparent); border-radius: 0.5rem; font-size: 0.875rem; line-height: 1.4; background: color-mix(in oklab, currentColor 4%, transparent)"
    >
        @foreach ($dimensions as $key => $info)
            <template x-if="active === '{{ $key }}'">
                <span>
                    <strong style="font-weight: 600">{{ $info['letter'] }} · {{ $info['title'] }}.</strong>
                    {{ $info['text'] }}
                </span>
            </template>
        @endforeach
        <span x-show="!active" style="opacity: 0.7">Clique em um campo de medida para ver onde ele fica no desenho. O esquema não está em escala.</span>
    </p>
</div>
