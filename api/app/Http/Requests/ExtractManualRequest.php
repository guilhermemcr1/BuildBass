<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\UploadedFile;

// Validação do PDF enviado para a leitura de manual. Só confere o arquivo; páginas,
// texto e cotas vêm depois, no service. Nada do arquivo é gravado.
class ExtractManualRequest extends FormRequest
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
            'manual' => ['required', 'file', 'mimes:pdf', 'max:'.(int) config('manual_extraction.max_kb')],
            'locale' => ['required', 'in:'.implode(',', StoreDriverSubmissionRequest::LOCALES)],
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        $upload = $this->files->get('manual');
        $failed = array_key_first($validator->failed()['manual'] ?? []);
        $rejectedBySize = $upload instanceof UploadedFile
            && in_array($upload->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);

        $reason = match (true) {
            $rejectedBySize, $failed === 'Max' => 'too_large',
            $failed === 'Required' => 'required',
            default => 'not_pdf',
        };

        throw new HttpResponseException(response()->json([
            'message' => (string) __("manual.{$reason}"),
            'code' => 'invalid_file',
            'errors' => ['manual' => [$reason]],
        ], 422));
    }

    public function manualFile(): UploadedFile
    {
        /** @var UploadedFile $file */
        $file = $this->file('manual');

        return $file;
    }
}
