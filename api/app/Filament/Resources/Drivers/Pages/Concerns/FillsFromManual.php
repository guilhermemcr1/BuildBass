<?php

namespace App\Filament\Resources\Drivers\Pages\Concerns;

use App\Exceptions\Manual\ManualException;
use App\Filament\Schemas\DriverParameterFields;
use App\Services\Manual\ManualExtractionService;
use App\Support\DriverDerivation;
use App\Support\DriverVariant;
use Filament\Actions\Action;
use Filament\Forms\Components\FileUpload;
use Filament\Notifications\Notification;
use Filament\Support\Icons\Heroicon;
use Illuminate\Http\UploadedFile;

/**
 * "Preencher com IA a partir do manual" no cadastro do admin: o mesmo serviço do envio público
 * (PDF → texto → IA → sugestão), com as mesmas cotas e a mesma auditoria. A sugestão só preenche o
 * formulário; nada é salvo até o moderador revisar e criar o driver.
 */
trait FillsFromManual
{
    protected function readManualAction(): Action
    {
        $service = app(ManualExtractionService::class);

        return Action::make('readManual')
            ->label('Preencher com IA a partir do manual')
            ->icon(Heroicon::OutlinedSparkles)
            ->color('gray')
            ->disabled(! $service->enabled())
            ->tooltip($service->enabled() ? null : 'A leitura por IA está desligada ou sem chave configurada.')
            ->modalHeading('Preencher a partir do manual')
            ->modalDescription('Envie o PDF do manual ou da ficha técnica. Só o texto vai para a IA e o arquivo não é guardado. Confira os valores antes de salvar: a IA pode errar.')
            ->modalSubmitActionLabel('Ler manual')
            ->modalWidth('lg')
            ->schema([
                FileUpload::make('manual')
                    ->label('PDF do manual')
                    ->acceptedFileTypes(['application/pdf'])
                    ->maxSize((int) config('manual_extraction.max_kb'))
                    ->storeFiles(false)
                    ->required()
                    ->validationMessages([
                        'required' => (string) __('manual.required'),
                        'max' => (string) __('manual.too_large'),
                        'mimetypes' => (string) __('manual.not_pdf'),
                    ]),
            ])
            ->action(function (array $data) use ($service): void {
                $file = $data['manual'] ?? null;

                if (! $file instanceof UploadedFile) {
                    Notification::make()->danger()->title((string) __('manual.required'))->send();

                    return;
                }

                try {
                    $result = $service->extract($file, (string) request()->ip());
                } catch (ManualException $exception) {
                    Notification::make()->danger()->title('Não foi possível ler o manual')
                        ->body($exception->getMessage())->persistent()->send();

                    return;
                }

                $this->applyManualSuggestion($result);
            });
    }

    /**
     * Só o que a IA achou entra no formulário; o que ela não achou fica como estava.
     *
     * @param  array{suggestion: array<string, string|float|null>, suspect: list<string>, discarded: list<string>, warnings: list<string>}  $result
     */
    protected function applyManualSuggestion(array $result): void
    {
        // O que estava só calculado não segura o lugar do que o manual traz: parte do digitado.
        foreach ((array) ($this->data['auto_keys'] ?? []) as $key) {
            $this->data[$key] = null;
        }
        $this->data['auto_keys'] = [];

        $filled = array_filter($result['suggestion'], fn (string|float|null $value): bool => $value !== null);

        foreach ($filled as $key => $value) {
            // A sugestão vem em SI; os campos mostram a unidade das fichas (mH, mm, L…).
            $this->data[$key] = match (true) {
                is_float($value) => DriverParameterFields::toDisplay($key, $value),
                $key === 'variant' => DriverVariant::forInput((string) $value),
                default => $value,
            };
        }

        // Com os valores do manual no lugar, o que dá para calcular dos outros entra sozinho.
        $before = $this->data;
        $this->data = DriverDerivation::apply($this->data);
        $calculated = array_values(array_filter(
            (array) $this->data['auto_keys'],
            fn (mixed $key): bool => is_string($key) && ($before[$key] ?? null) === null,
        ));

        $notes = ['Revise todos os campos antes de salvar.'];

        if (in_array('nothing_found', $result['warnings'], true)) {
            $notes[] = 'O PDF não trouxe nenhum parâmetro reconhecível.';
        }

        if (in_array('multiple_drivers', $result['warnings'], true)) {
            $notes[] = 'O manual lista mais de um driver; só o primeiro foi usado.';
        }

        if ($calculated !== []) {
            $notes[] = 'Calculados a partir dos outros: '.$this->manualLabels($calculated).'.';
        }

        if ($result['suspect'] !== []) {
            $notes[] = 'Valores que não fecham entre si: '.$this->manualLabels($result['suspect']).'.';
        }

        if ($result['discarded'] !== []) {
            $notes[] = 'Valores fora da faixa, não preenchidos: '.$this->manualLabels($result['discarded']).'.';
        }

        $notification = Notification::make()
            ->title(count($filled).' campos preenchidos pela IA')
            ->body(implode("\n", $notes));

        ($result['suspect'] !== [] || $result['discarded'] !== [] || $filled === [] ? $notification->warning() : $notification->success())
            ->persistent()
            ->send();
    }

    /** @param  list<string>  $keys */
    private function manualLabels(array $keys): string
    {
        return implode(', ', array_map(
            fn (string $key): string => DriverParameterFields::LABELS[$key] ?? $key,
            array_values(array_unique($keys)),
        ));
    }
}
