<?php

namespace App\Filament\Resources\DriverSubmissions\Tables;

use App\Enums\SubmissionStatus;
use App\Models\DriverSubmission;
use App\Services\DriverSubmissionService;
use Filament\Actions\EditAction;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class DriverSubmissionsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'asc')
            ->paginated([25])
            ->defaultPaginationPageOption(25)
            ->striped()
            ->emptyStateIcon(Heroicon::OutlinedInbox)
            ->emptyStateHeading('Nenhum envio nesta situação')
            ->emptyStateDescription('Quando alguém enviar um driver pelo site, ele aparece aqui para revisão. Troque o filtro de situação para ver os já decididos.')
            ->columns([
                TextColumn::make('status')->label('Situação')->badge(),
                TextColumn::make('brand')->label('Fabricante')->searchable(),
                TextColumn::make('model')->label('Modelo')->searchable(),
                TextColumn::make('variant')->label('Variante')->placeholder('—'),
                TextColumn::make('type')->label('Tipo')->formatStateUsing(fn (?string $state): ?string => $state === null ? null : ucfirst($state))->placeholder('—'),
                TextColumn::make('fs_hz')->label('Fs (Hz)')->numeric(decimalPlaces: 2),
                TextColumn::make('qts')->label('Qts')->numeric(decimalPlaces: 3),
                TextColumn::make('vas_m3')->label('Vas (m³)')->numeric(decimalPlaces: 5),
                TextColumn::make('created_at')->label('Enviado em')->dateTime('d/m/Y H:i')->sortable(),
                TextColumn::make('alerts')
                    ->label('Alertas')
                    ->state(fn (DriverSubmission $record): array => app(DriverSubmissionService::class)->alertsFor($record))
                    ->badge()
                    ->color('warning'),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Situação')
                    ->options(collect(SubmissionStatus::cases())->mapWithKeys(
                        fn (SubmissionStatus $status): array => [$status->value => $status->label()],
                    )->all())
                    ->default(SubmissionStatus::Pending->value),
            ])
            ->recordActions([
                EditAction::make()->label('Revisar'),
            ]);
    }
}
