<?php

namespace App\Http\Requests;

use App\Filament\Schemas\IdentityFields;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Services\Security\SubmissionAttempts;
use App\Support\DriverVariant;
use Closure;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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

        // A variante é a impedância em ohms: "4", "4 ohms" e "4 Ω" chegam ao banco como "4 Ω".
        if (isset($clean['variant'])) {
            $clean['variant'] = DriverVariant::format($clean['variant']);
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
     * Texto puro de uma linha: sem marcação, sem caracteres de controle e com espaços colapsados.
     */
    public static function plainText(string $value): string
    {
        $text = strip_tags($value);
        $text = (string) preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $text);

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    /**
     * Recusa pela validação: vai para a trilha só com os nomes dos campos (nunca o que foi digitado)
     * e conta falta para o IP. Depois segue o fluxo normal do Laravel (422).
     */
    protected function failedValidation(Validator $validator): void
    {
        app(SubmissionAttempts::class)->refused(SubmissionAttempts::REASON_INVALID, $this->ip(), [
            'campos' => array_slice(array_keys($validator->errors()->messages()), 0, 20),
        ]);

        parent::failedValidation($validator);
    }

    /**
     * @return array<string, list<string|Closure|Rule>>
     */
    public function rules(): array
    {
        $rules = [
            // Mesma regra do painel: sem [ ] * _ : < > o nome não vira link nem formatação no
            // Markdown do e-mail de decisão enviado ao remetente.
            'brand' => ['required', 'string', 'min:1', 'max:80', 'regex:'.IdentityFields::NAME_PATTERN],
            'model' => ['required', 'string', 'min:1', 'max:80', 'regex:'.IdentityFields::NAME_PATTERN],
            'variant' => ['nullable', 'string', 'max:40', function (string $attribute, mixed $value, Closure $fail): void {
                if (trim((string) $value) !== '' && DriverVariant::parse((string) $value) === null) {
                    $fail((string) __('submission.impedance', ['min' => DriverVariant::MIN_OHM, 'max' => DriverVariant::MAX_OHM]));
                }
            }],
            'type' => ['nullable', 'string', Rule::in(Driver::TYPES)],
            'source' => ['required', 'string', 'min:1', 'max:255'],
            'contact_email' => ['required', 'string', 'email', 'max:254'],
            'locale' => ['required', 'in:'.implode(',', self::LOCALES)],
        ];

        foreach (Driver::RANGES as $key => [$min, $max]) {
            $presence = in_array($key, Driver::REQUIRED_PARAMETERS, true) ? 'required' : 'nullable';
            $rules[$key] = [$presence, 'numeric', "between:{$min},{$max}"];
        }

        // Medidas físicas: todas opcionais, mesmas faixas do catálogo.
        $rules['drv_shape'] = ['nullable', 'string', Rule::in(Driver::SHAPES)];
        $rules['drv_piston'] = ['nullable', 'string', Rule::in(Driver::PISTONS)];

        foreach (Driver::DIMENSION_RANGES as $key => [$min, $max]) {
            $rules[$key] = ['nullable', 'numeric', "between:{$min},{$max}"];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $messages = [];

        foreach (['required', 'string', 'numeric', 'between', 'max', 'min', 'email', 'in'] as $rule) {
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
            array_flip([...DriverSubmission::DRIVER_FIELDS, ...DriverSubmission::DIMENSION_FIELDS, 'contact_email', 'locale']),
        );
    }
}
