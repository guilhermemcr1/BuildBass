<?php

namespace App\Http\Requests;

use App\Models\Driver;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Mesmas regras do front (web/src/hooks/use-driver-search.ts): termo de 2 a 60 caracteres depois
// de aparar os espaços. Os filtros (marca, tipo, diâmetro) refinam a busca e, sozinhos, listam o
// que combina sem precisar de texto. O servidor nunca confia no front.
class SearchDriversRequest extends FormRequest
{
    /** Parâmetros que, sozinhos, já bastam para listar. */
    public const FILTERS = ['brand', 'type', 'diameter_min_m', 'diameter_max_m'];

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

        return [
            'q' => ['required_without_all:'.implode(',', self::FILTERS), 'nullable', 'string', 'min:2', 'max:60'],
            'brand' => ['nullable', 'string', 'min:1', 'max:80'],
            'type' => ['nullable', 'string', Rule::in(Driver::TYPES)],
            'diameter_min_m' => ['nullable', 'numeric', "between:{$min},{$max}"],
            'diameter_max_m' => ['nullable', 'numeric', "between:{$min},{$max}"],
        ];
    }
}
