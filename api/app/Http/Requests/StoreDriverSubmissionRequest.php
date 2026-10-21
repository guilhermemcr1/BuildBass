<?php

namespace App\Http\Requests;

use App\Models\Driver;
use App\Models\DriverSubmission;
use Illuminate\Foundation\Http\FormRequest;

// Mesmas regras do front (web/src/lib/submission/schema.ts): as faixas vêm de Driver::RANGES e
// tests/Fixtures/submission-ranges.json trava a igualdade com PARAMETERS. O servidor nunca
// confia no front.
class StoreDriverSubmissionRequest extends FormRequest
{
    public const LOCALES = ['pt-BR', 'en'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $clean = [];

        foreach (['brand', 'model', 'variant', 'source'] as $field) {
            $value = $this->input($field);

            if (is_string($value)) {
                $clean[$field] = self::plainText($value);
            }
        }

        $email = $this->input('contact_email');

        if (is_string($email)) {
            $clean['contact_email'] = trim($email);
        }

        $locale = $this->input('locale');
        $clean['locale'] = is_string($locale) && in_array($locale, self::LOCALES, true) ? $locale : 'pt-BR';

        $this->merge($clean);
        app()->setLocale(str_replace('-', '_', $clean['locale']));
    }

    /**
     * Texto puro de uma linha: sem marcação, sem caracteres de controle e com espaços colapsados
     * (FR-013).
     */
    public static function plainText(string $value): string
    {
        $text = strip_tags($value);
        $text = (string) preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $text);

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        $rules = [
            'brand' => ['required', 'string', 'min:1', 'max:80'],
            'model' => ['required', 'string', 'min:1', 'max:80'],
            'variant' => ['nullable', 'string', 'max:40'],
            'source' => ['required', 'string', 'min:1', 'max:255'],
            'contact_email' => ['nullable', 'string', 'email', 'max:254'],
            'locale' => ['required', 'in:'.implode(',', self::LOCALES)],
        ];

        foreach (Driver::RANGES as $key => [$min, $max]) {
            $presence = in_array($key, Driver::REQUIRED_PARAMETERS, true) ? 'required' : 'nullable';
            $rules[$key] = [$presence, 'numeric', "between:{$min},{$max}"];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $messages = [];

        foreach (['required', 'string', 'numeric', 'between', 'max', 'min', 'email'] as $rule) {
            $messages[$rule] = (string) __("submission.{$rule}");
        }

        return $messages;
    }

    /**
     * Só os campos do driver e do contato chegam ao service.
     *
     * @return array<string, mixed>
     */
    public function submissionData(): array
    {
        /** @var array<string, mixed> $validated */
        $validated = $this->validated();

        return array_intersect_key(
            $validated,
            array_flip([...DriverSubmission::DRIVER_FIELDS, 'contact_email', 'locale']),
        );
    }
}
