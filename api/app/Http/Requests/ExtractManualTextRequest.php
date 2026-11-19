<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

// Texto colado com os parâmetros do driver (alternativa ao PDF). Só confere tamanho e tipo; o
// filtro do que segue para a IA é do ManualTextFilter, no service. Nada é gravado.
class ExtractManualTextRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $locale = $this->input('locale');
        $locale = is_string($locale) && in_array($locale, StoreDriverSubmissionRequest::LOCALES, true) ? $locale : 'pt-BR';

        $this->merge(['locale' => $locale]);
        app()->setLocale(str_replace('-', '_', $locale));
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'min:10', 'max:'.(int) config('manual_extraction.text_max_input')],
            'locale' => ['required', 'in:'.implode(',', StoreDriverSubmissionRequest::LOCALES)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'text.required' => (string) __('manual.text_required'),
            'text.min' => (string) __('manual.text_required'),
            'text.max' => (string) __('manual.text_too_long', ['max' => (int) config('manual_extraction.text_max_input')]),
        ];
    }

    public function manualText(): string
    {
        return (string) $this->input('text');
    }
}
