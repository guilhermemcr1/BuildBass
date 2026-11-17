<?php

namespace App\Filament\Resources\AuditEvents\Tables;

use App\Enums\AuditType;
use App\Models\AuditEvent;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\TextInput;
use Filament\Support\Enums\FontFamily;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class AuditEventsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->striped()
            ->persistFiltersInSession()
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(['default' => 1, 'sm' => 2, 'xl' => 5])
            ->searchPlaceholder('Buscar por IP, autor ou objeto')
            ->emptyStateIcon(Heroicon::OutlinedClipboardDocumentList)
            ->emptyStateHeading('Nenhum evento encontrado')
            ->emptyStateDescription('Nada foi registrado com esses filtros. Amplie o período ou limpe os filtros.')
            ->columns([
                TextColumn::make('created_at')
                    ->label('Momento')
                    ->dateTime('d/m/Y H:i:s')
                    ->description(fn (AuditEvent $record): string => $record->created_at->diffForHumans())
                    ->sortable(),
                TextColumn::make('type')->label('Tipo')->badge(),
                TextColumn::make('outcome')
                    ->label('Resultado')
                    ->badge()
                    ->formatStateUsing(fn (AuditEvent $record): ?string => $record->outcomeLabel())
                    ->color(fn (AuditEvent $record): string => $record->outcomeColor())
                    ->description(fn (AuditEvent $record): ?string => $record->reasonLabel())
                    ->placeholder('—'),
                TextColumn::make('ip_address')
                    ->label('IP')
                    ->fontFamily(FontFamily::Mono)
                    ->copyable()
                    ->copyMessage('IP copiado')
                    ->searchable()
                    ->placeholder('—'),
                TextColumn::make('actor_name')
                    ->label('Autor')
                    ->description(fn (AuditEvent $record): ?string => $record->actor_email)
                    ->searchable(['actor_name', 'actor_email'])
                    ->toggleable()
                    ->placeholder('—'),
                TextColumn::make('subject_label')
                    ->label('Objeto')
                    ->limit(40)
                    ->tooltip(fn (AuditEvent $record): ?string => $record->subject_label)
                    ->searchable()
                    ->toggleable()
                    ->placeholder('—'),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->label('Tipo')
                    ->multiple()
                    ->options(AuditType::grouped()),
                SelectFilter::make('outcome')
                    ->label('Resultado')
                    ->options([
                        'ok' => (string) __('audit.outcomes.ok'),
                        'failed' => (string) __('audit.outcomes.failed'),
                        'blocked' => (string) __('audit.outcomes.blocked'),
                    ]),
                SelectFilter::make('actor_email')
                    ->label('Autor')
                    ->options(fn (): array => AuditEvent::query()
                        ->whereNotNull('actor_email')
                        ->whereNotNull('actor_id')
                        ->orderBy('created_at')
                        ->pluck('actor_name', 'actor_email')
                        ->map(fn (?string $name, string $email): string => trim("{$name} ({$email})"))
                        ->all()),
                Filter::make('ip')
                    ->label('IP')
                    ->schema([TextInput::make('value')->label('IP exato')->maxLength(45)])
                    ->query(fn (Builder $query, array $data): Builder => $query
                        ->when($data['value'] ?? null, fn (Builder $query, string $ip): Builder => $query->where('ip_address', trim($ip))))
                    ->indicateUsing(fn (array $data): ?string => ($data['value'] ?? null) ? "IP: {$data['value']}" : null),
                Filter::make('period')
                    ->label('Período')
                    ->schema([
                        DatePicker::make('from')->label('De'),
                        DatePicker::make('until')->label('Até'),
                    ])
                    ->columns(2)
                    // As datas escolhidas são do fuso do painel; o banco guarda em UTC.
                    ->query(fn (Builder $query, array $data): Builder => $query
                        ->when($data['from'] ?? null, fn (Builder $query, string $from): Builder => $query->where('created_at', '>=', self::boundary($from, false)))
                        ->when($data['until'] ?? null, fn (Builder $query, string $until): Builder => $query->where('created_at', '<=', self::boundary($until, true)))),
            ])
            ->recordActions([
                ViewAction::make()->label('Detalhes'),
            ]);
    }

    private static function boundary(string $day, bool $endOfDay): Carbon
    {
        $local = Carbon::parse($day, (string) config('app.display_timezone'));

        return ($endOfDay ? $local->endOfDay() : $local->startOfDay())->utc();
    }
}
