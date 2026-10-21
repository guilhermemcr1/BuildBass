<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

// Mesmas regras do front (web/src/hooks/use-driver-search.ts): termo de 2 a 60 caracteres depois
// de aparar os espaços. O servidor nunca confia no front.
class SearchDriversRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $term = $this->query('q');

        if (is_string($term)) {
            $this->merge(['q' => trim($term)]);
        }
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:2', 'max:60'],
        ];
    }
}
