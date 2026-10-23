<?php

namespace App\Filament\Resources\Drivers\Schemas;

use App\Exceptions\DriverImageException;
use App\Filament\Schemas\DriverDimensionFields;
use App\Filament\Schemas\DriverParameterFields;
use App\Filament\Schemas\IdentityFields;
use App\Models\Driver;
use App\Services\DriverImageStore;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Components\Text;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Illuminate\Validation\ValidationException;
use Livewire\Component;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

class DriverForm
{
    public static function configure(Schema $schema): Schema
    {
        // Uma seção por linha e o conteúdo em abas: cada aba mostra só um assunto, e um selo
        // vermelho avisa qual aba tem campo com erro (o campo pode estar numa aba fechada).
        return $schema->columns(1)->components([
            Tabs::make('Driver')
                ->columnSpanFull()
                ->tabs([
                    self::tab('Identificação', Heroicon::OutlinedIdentification, self::IDENTITY_KEYS)
                        ->schema([
                            Text::make('Fabricante, modelo e variante juntos não podem repetir.')->color('gray'),
                            Grid::make(['default' => 1, 'md' => 2, 'xl' => 4])->schema([
                                IdentityFields::brand(),
                                IdentityFields::model(),
                                IdentityFields::variant(),
                                Select::make('type')->label('Tipo')
                                    ->options(array_combine(Driver::TYPES, array_map('ucfirst', Driver::TYPES)))
                                    ->placeholder('Não informado')
                                    ->native(false),
                                IdentityFields::source()
                                    ->columnSpan(['md' => 2, 'xl' => 3]),
                                TextEntry::make('origin_label')
                                    ->label('Origem no catálogo')
                                    ->state(fn (?Driver $record): ?string => $record?->origin->label())
                                    ->visible(fn (?Driver $record): bool => $record !== null),
                            ]),
                        ]),
                    self::tab('Parâmetros', Heroicon::OutlinedAdjustmentsHorizontal, array_keys(DriverParameterFields::LABELS))
                        ->schema([
                            Text::make('Thiele-Small em unidades do SI, ponto nos decimais. Fs, Qts e Vas são obrigatórios.')->color('gray'),
                            ...DriverParameterFields::groups(),
                        ]),
                    self::tab('Dimensões', Heroicon::OutlinedViewfinderCircle, Driver::DIMENSION_FIELDS)
                        ->schema([
                            Text::make('Opcionais. Permitem à bancada montar o modelo do alto-falante.')->color('gray'),
                            ...DriverDimensionFields::make(),
                        ]),
                    self::tab('Imagens', Heroicon::OutlinedPhoto, ['images'])
                        ->schema([
                            Text::make((string) __('driver_images.help'))->color('gray'),
                            FileUpload::make('images')
                                ->hiddenLabel()
                                ->multiple()
                                ->reorderable()
                                ->image()
                                ->panelLayout('grid')
                                ->imagePreviewHeight('140')
                                ->acceptedFileTypes(config('driver_images.mimes'))
                                ->maxFiles((int) config('driver_images.max_files'))
                                ->maxSize((int) config('driver_images.max_kb'))
                                ->disk(config('driver_images.disk'))
                                ->visibility('public')
                                ->disabled(fn (): bool => ! app(DriverImageStore::class)->available())
                                // Converte para WebP e guarda só a versão convertida; o nome do
                                // arquivo enviado nunca é usado.
                                ->saveUploadedFileUsing(function (TemporaryUploadedFile $file): string {
                                    try {
                                        return app(DriverImageStore::class)->store((string) file_get_contents($file->getRealPath()));
                                    } catch (DriverImageException $exception) {
                                        throw ValidationException::withMessages(['data.images' => $exception->getMessage()]);
                                    }
                                }),
                        ]),
                ]),
        ]);
    }

    /** Campos da aba Identificação (para o selo de erro). */
    private const IDENTITY_KEYS = ['brand', 'model', 'variant', 'type', 'source'];

    /**
     * Aba com selo vermelho quando algum dos campos dela tem erro de validação.
     *
     * @param  list<string>  $keys
     */
    private static function tab(string $label, Heroicon $icon, array $keys): Tab
    {
        return Tab::make($label)
            ->icon($icon)
            ->badge(function (Component $livewire) use ($keys): ?int {
                $errors = count(array_filter(
                    array_keys($livewire->getErrorBag()->messages()),
                    fn (int|string $key): bool => in_array((string) preg_replace('/^data\./', '', (string) $key), $keys, true),
                ));

                return $errors === 0 ? null : $errors;
            })
            ->badgeColor('danger');
    }
}
