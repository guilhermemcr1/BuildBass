<?php

namespace App\Filament\Resources\Drivers\Tables;

use App\Enums\DriverOrigin;
use App\Models\Driver;
use App\Models\Moderator;
use App\Services\DriverService;
use App\Support\SearchText;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Facades\Filament;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use LogicException;

class DriversTable
{
    private const ESCAPE = '!';

    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort(fn (Builder $query): Builder => $query
                ->orderBy('brand')->orderBy('model')->orderBy('variant'))
            ->paginated([25])
            ->defaultPaginationPageOption(25)
            ->striped()
            ->searchPlaceholder('Buscar por fabricante, modelo ou variante')
            ->emptyStateIcon(Heroicon::OutlinedSpeakerWave)
            ->emptyStateHeading('Nenhum driver encontrado')
            ->emptyStateDescription('Ajuste a busca ou os filtros, ou cadastre um novo driver.')
            ->emptyStateActions([
                CreateAction::make()->label('Novo driver'),
            ])
            ->columns([
                // A busca é uma só: cada palavra tem de estar em "fabricante modelo variante", sem
                // acento e sem caixa (a mesma regra do catálogo público).
                TextColumn::make('brand')->label('Fabricante')->sortable()
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query->whereRaw(
                        'search_text LIKE ? ESCAPE \''.self::ESCAPE.'\'',
                        ['%'.self::escapeLike(SearchText::normalize($search)).'%'],
                    )),
                TextColumn::make('model')->label('Modelo')->sortable(),
                TextColumn::make('variant')->label('Variante')->placeholder('—'),
                TextColumn::make('type')->label('Tipo')->sortable()
                    ->formatStateUsing(fn (?string $state): ?string => $state === null ? null : ucfirst($state))
                    ->placeholder('—'),
                TextColumn::make('origin')->label('Origem')->badge(),
                TextColumn::make('source')->label('Fonte')->limit(40)->toggleable(),
                TextColumn::make('fs_hz')->label('Fs (Hz)')->numeric(decimalPlaces: 2)->sortable(),
                TextColumn::make('qts')->label('Qts')->numeric(decimalPlaces: 3)->sortable(),
                TextColumn::make('vas_m3')->label('Vas (m³)')->numeric(decimalPlaces: 5)->sortable(),
                TextColumn::make('created_at')->label('Cadastrado em')->dateTime('d/m/Y H:i')->sortable(),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->label('Tipo')
                    ->options([
                        ...array_combine(Driver::TYPES, array_map('ucfirst', Driver::TYPES)),
                        'none' => 'Sem tipo',
                    ])
                    ->query(fn (Builder $query, array $data): Builder => match ($data['value'] ?? null) {
                        null, '' => $query,
                        'none' => $query->whereNull('type'),
                        default => $query->where('type', $data['value']),
                    }),
                SelectFilter::make('origin')
                    ->label('Origem')
                    ->options(collect(DriverOrigin::cases())->mapWithKeys(
                        fn (DriverOrigin $origin): array => [$origin->value => $origin->label()],
                    )->all()),
            ])
            ->recordActions([
                EditAction::make()->label('Editar'),
                DeleteAction::make()
                    ->label('Excluir')
                    ->modalHeading(fn (Driver $record): string => "Excluir {$record->brand} {$record->model}?")
                    ->modalDescription('O driver sai do catálogo e as imagens dele também são apagadas. Projetos já exportados guardam uma cópia dos parâmetros e não são afetados.')
                    ->using(function (Driver $record): bool {
                        app(DriverService::class)->delete($record, self::moderator());

                        return true;
                    }),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make()
                        ->label('Excluir selecionados')
                        ->modalDescription('Os drivers saem do catálogo e as imagens deles também são apagadas. Cada exclusão fica registrada na auditoria.')
                        ->using(function (Collection $records): void {
                            foreach ($records as $record) {
                                app(DriverService::class)->delete($record, self::moderator());
                            }
                        }),
                ]),
            ]);
    }

    private static function moderator(): Moderator
    {
        $moderator = Filament::auth()->user();

        if (! $moderator instanceof Moderator) {
            throw new LogicException('O painel de moderação espera um moderador autenticado.');
        }

        return $moderator;
    }

    private static function escapeLike(string $word): string
    {
        return str_replace(
            [self::ESCAPE, '%', '_'],
            [self::ESCAPE.self::ESCAPE, self::ESCAPE.'%', self::ESCAPE.'_'],
            $word,
        );
    }
}
