<?php

namespace App\Filament\Resources\AuditEvents\Tables;

use App\Enums\AuditType;
use App\Models\AuditEvent;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DatePicker;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class AuditEventsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->paginated([25])
            ->defaultPaginationPageOption(25)
            ->striped()
            ->emptyStateIcon(Heroicon::OutlinedClipboardDocumentList)
            ->emptyStateHeading('Nenhum evento encontrado')
            ->emptyStateDescription('Nada foi registrado com esses filtros. Amplie o período ou limpe os filtros.')
            ->columns([
                TextColumn::make('created_at')->label('Momento')->dateTime('d/m/Y H:i:s')->sortable(),
                TextColumn::make('type')->label('Tipo')->badge(),
                TextColumn::make('actor_name')
                    ->label('Autor')
                    ->description(fn (AuditEvent $record): ?string => $record->actor_email)
                    ->placeholder('—'),
                TextColumn::make('subject_label')->label('Objeto')->limit(50)->placeholder('—'),
                TextColumn::make('result')
                    ->label('Resultado')
                    ->state(fn (AuditEvent $record): string => self::result($record))
                    ->placeholder('—'),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->label('Tipo')
                    ->options(AuditType::grouped()),
                SelectFilter::make('actor_email')
                    ->label('Autor')
                    ->options(fn (): array => AuditEvent::query()
                        ->whereNotNull('actor_email')
                        ->whereNotNull('actor_id')
                        ->orderBy('created_at')
                        ->pluck('actor_name', 'actor_email')
                        ->map(fn (?string $name, string $email): string => trim("{$name} ({$email})"))
                        ->all()),
                Filter::make('period')
                    ->label('Período')
                    ->schema([
                        DatePicker::make('from')->label('De'),
                        DatePicker::make('until')->label('Até'),
                    ])
                    ->columns(2)
                    ->query(fn (Builder $query, array $data): Builder => $query
                        ->when($data['from'] ?? null, fn (Builder $query, string $from): Builder => $query->where('created_at', '>=', $from.' 00:00:00'))
                        ->when($data['until'] ?? null, fn (Builder $query, string $until): Builder => $query->where('created_at', '<=', $until.' 23:59:59'))),
            ])
            ->recordActions([
                ViewAction::make()->label('Detalhes'),
            ]);
    }

    private static function result(AuditEvent $record): string
    {
        $outcome = $record->outcome === null ? null : (string) __("audit.outcomes.{$record->outcome}");
        $reason = $record->reason === null ? null : (string) __("audit.reasons.{$record->reason}");

        if ($reason === null || str_starts_with($reason, 'audit.reasons.')) {
            $reason = $record->reason;
        }

        return implode(' · ', array_filter([$outcome, $reason], fn (?string $part): bool => $part !== null && $part !== ''));
    }
}
