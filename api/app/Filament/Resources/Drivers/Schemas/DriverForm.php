<?php

namespace App\Filament\Resources\Drivers\Schemas;

use App\Exceptions\DriverImageException;
use App\Filament\Schemas\DriverDimensionFields;
use App\Filament\Schemas\DriverParameterFields;
use App\Filament\Schemas\IdentityFields;
use App\Models\Driver;
use App\Services\DriverImageStore;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Select;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Components\Text;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Utilities\Set;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\HtmlString;
use Illuminate\Validation\ValidationException;
use Livewire\Component;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;
use Throwable;

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
                                // Ao enviar, remover ou arrastar, a principal acompanha a primeira.
                                ->live()
                                ->afterStateUpdated(fn (Set $set) => $set('cover', '0'))
                                // Converte para WebP e guarda só a versão convertida; o nome do
                                // arquivo enviado nunca é usado.
                                ->saveUploadedFileUsing(function (TemporaryUploadedFile $file): string {
                                    try {
                                        return app(DriverImageStore::class)->store((string) file_get_contents($file->getRealPath()));
                                    } catch (DriverImageException $exception) {
                                        throw ValidationException::withMessages(['data.images' => $exception->getMessage()]);
                                    }
                                }),
                            self::coverField(),
                        ]),
                ]),
        ]);
    }

    /**
     * Escolha da imagem principal (a capa do catálogo). Não é gravada à parte: escolher uma move a
     * imagem para o começo da lista, e a primeira da lista é a capa. As opções são as posições na
     * lista (`$get('images')` devolve a lista em ordem), então a marcada é sempre a "0".
     */
    private static function coverField(): Radio
    {
        return Radio::make('cover')
            ->label('Imagem principal')
            ->helperText('É a capa mostrada no catálogo e na busca.')
            ->dehydrated(false)
            ->live()
            ->inline()
            ->visible(fn (Get $get): bool => count((array) $get('images')) > 1)
            ->afterStateHydrated(fn (Radio $component) => $component->state('0'))
            ->options(fn (Get $get): array => self::coverOptions(array_values((array) $get('images'))))
            ->afterStateUpdated(function (Set $set, Get $get, ?string $state): void {
                $images = array_values((array) $get('images'));
                $index = (int) $state;

                if ($state !== null && $index > 0 && $index < count($images)) {
                    $cover = array_splice($images, $index, 1);
                    $set('images', [...$cover, ...$images]);
                }

                $set('cover', '0');
            });
    }

    /**
     * Uma opção por imagem, com a miniatura; o rótulo é HTML montado só com valores escapados.
     *
     * @param  list<mixed>  $images
     * @return array<int, HtmlString>
     */
    private static function coverOptions(array $images): array
    {
        $options = [];

        foreach ($images as $index => $file) {
            $position = $index + 1;
            $url = self::previewUrl($file);
            $thumb = $url === null
                ? ''
                : '<img src="'.e($url).'" alt="" style="height:56px;width:56px;object-fit:cover;border-radius:6px;margin-bottom:4px">';

            $options[$index] = new HtmlString($thumb.e("Imagem {$position}"));
        }

        return $options;
    }

    private static function previewUrl(mixed $file): ?string
    {
        if (is_string($file)) {
            $store = app(DriverImageStore::class);

            return $store->validPath($file) ? $store->thumbUrl($file) : null;
        }

        if ($file instanceof TemporaryUploadedFile && $file->isPreviewable()) {
            try {
                return $file->temporaryUrl();
            } catch (Throwable) {
                return null;
            }
        }

        return null;
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
