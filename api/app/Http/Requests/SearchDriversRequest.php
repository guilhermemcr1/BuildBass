<?php

namespace App\Http\Requests;

use App\Models\Driver;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Mesmas regras do front (web/src/hooks/use-driver-search.ts): termo opcional de até 60 caracteres
// depois de aparar os espaços. Sem termo nem filtro, lista o catálogo (primeira página) para a
// pessoa navegar. Os filtros (marca, tipo, diâmetro) refinam a busca. O servidor nunca confia no front.
class SearchDriversRequest extends FormRequest
{
    /** Filtros opcionais que se somam ao termo. */
    public const FILTERS = [
        'brand', 'type', 'diameter_min_m', 'diameter_max_m',
        ...self::PARAMETER_FILTERS_KEYS,
    ];

    /** Faixas pelos parâmetros (mínimo e máximo inclusivos), na unidade SI do campo. */
    public const PARAMETER_FILTERS = [
        'fs_min_hz' => 'fs_hz', 'fs_max_hz' => 'fs_hz',
        'qts_min' => 'qts', 'qts_max' => 'qts',
        'vas_min_m3' => 'vas_m3', 'vas_max_m3' => 'vas_m3',
    ];

    private const PARAMETER_FILTERS_KEYS = ['fs_min_hz', 'fs_max_hz', 'qts_min', 'qts_max', 'vas_min_m3', 'vas_max_m3'];

    public const MAX_OFFSET = 1000;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $clean = [];

        foreach (['q', 'brand'] as $field) {
            $value = $this->query($field);

            if (is_string($value)) {
                $clean[$field] = trim($value);
            }
        }

        $this->merge($clean);
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        [$min, $max] = Driver::RANGES['nominal_diameter_m'];
        $parameters = [];

        foreach (self::PARAMETER_FILTERS as $key => $field) {
            [$low, $high] = Driver::RANGES[$field];
            $parameters[$key] = ['nullable', 'numeric', "between:{$low},{$high}"];
        }

        return [
            ...$parameters,
            'q' => ['nullable', 'string', 'max:60'],
            // "Mostrar mais": a partir de qual resultado. O teto evita varrer o catálogo inteiro.
            'offset' => ['nullable', 'integer', 'between:0,'.self::MAX_OFFSET],
            'brand' => ['nullable', 'string', 'min:1', 'max:80'],
            'type' => ['nullable', 'string', Rule::in(Driver::TYPES)],
            'diameter_min_m' => ['nullable', 'numeric', "between:{$min},{$max}"],
            'diameter_max_m' => ['nullable', 'numeric', "between:{$min},{$max}"],
        ];
    }
}
