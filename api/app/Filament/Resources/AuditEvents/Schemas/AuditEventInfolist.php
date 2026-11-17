<?php

namespace App\Filament\Resources\AuditEvents\Schemas;

use App\Filament\Resources\AuditEvents\AuditEventResource;
use App\Models\AuditEvent;
use Filament\Infolists\Components\KeyValueEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Enums\FontFamily;
use Filament\Support\Icons\Heroicon;

// Detalhe de um evento em blocos (o quê, de onde, quem, sobre o quê). Um bloco sem dado nenhum some
// em vez de mostrar uma grade de traços.
class AuditEventInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Grid::make(['default' => 1, 'lg' => 2])
                ->columnSpanFull()
                ->schema([
                    Section::make('Evento')
                        ->icon(Heroicon::OutlinedBolt)
                        ->columns(['default' => 1, 'sm' => 2])
                        ->schema([
                            TextEntry::make('type')->label('Tipo')->badge(),
                            TextEntry::make('outcome')
                                ->label('Resultado')
                                ->badge()
                                ->formatStateUsing(fn (AuditEvent $record): ?string => $record->outcomeLabel())
                                ->color(fn (AuditEvent $record): string => $record->outcomeColor())
                                ->placeholder('—'),
                            TextEntry::make('created_at')
                                ->label('Data e hora')
                                ->dateTime('d/m/Y H:i:s')
                                ->helperText(fn (AuditEvent $record): string => $record->created_at->diffForHumans()
                                    .' · fuso '.config('app.display_timezone')),
                            TextEntry::make('reason')
                                ->label('Motivo')
                                ->formatStateUsing(fn (AuditEvent $record): ?string => $record->reasonLabel())
                                ->placeholder('—'),
                        ]),
                    Section::make('Origem')
                        ->icon(Heroicon::OutlinedGlobeAlt)
                        ->columns(['default' => 1, 'sm' => 2])
                        ->schema([
                            TextEntry::make('ip_address')
                                ->label('IP')
                                ->fontFamily(FontFamily::Mono)
                                ->copyable()
                                ->copyMessage('IP copiado')
                                ->url(fn (AuditEvent $record): ?string => $record->ip_address === null ? null : AuditEventResource::getUrl('index', [
                                    'filters' => ['ip' => ['value' => $record->ip_address]],
                                ]))
                                ->helperText(fn (AuditEvent $record): ?string => $record->ip_address === null ? null : 'Clique para ver todos os eventos deste IP')
                                ->placeholder('Não registrado'),
                            TextEntry::make('ip_hash')
                                ->label('Impressão de rede')
                                ->fontFamily(FontFamily::Mono)
                                ->formatStateUsing(fn (?string $state): ?string => $state === null ? null : substr($state, 0, 12))
                                ->helperText('Agrupa o mesmo remetente mesmo em eventos antigos, sem IP')
                                ->placeholder('—'),
                        ]),
                ]),
            Section::make('Autor')
                ->icon(Heroicon::OutlinedUser)
                ->columns(['default' => 1, 'sm' => 2])
                ->visible(fn (AuditEvent $record): bool => filled($record->actor_name) || filled($record->actor_email))
                ->schema([
                    TextEntry::make('actor_name')->label('Nome')->placeholder('—'),
                    TextEntry::make('actor_email')->label('E-mail (do moderador ou digitado no login)')->copyable()->placeholder('—'),
                ]),
            Section::make('Objeto')
                ->icon(Heroicon::OutlinedCube)
                ->columns(['default' => 1, 'sm' => 2])
                ->visible(fn (AuditEvent $record): bool => filled($record->subject_label) || filled($record->subject_id))
                ->schema([
                    TextEntry::make('subject_label')->label('Descrição')->placeholder('—'),
                    TextEntry::make('subject_id')->label('Identificador')->fontFamily(FontFamily::Mono)->copyable()->placeholder('—'),
                ]),
            Section::make('Alterações (antes → depois)')
                ->visible(fn (AuditEvent $record): bool => ! empty($record->changes))
                ->schema([
                    KeyValueEntry::make('changes_view')
                        ->hiddenLabel()
                        ->keyLabel('Campo')
                        ->valueLabel('Antes → depois')
                        ->state(fn (AuditEvent $record): array => self::changes($record)),
                ]),
            Section::make('Conteúdo registrado')
                ->visible(fn (AuditEvent $record): bool => ! empty($record->snapshot))
                ->schema([
                    KeyValueEntry::make('snapshot_view')
                        ->hiddenLabel()
                        ->keyLabel('Campo')
                        ->valueLabel('Valor')
                        ->state(fn (AuditEvent $record): array => array_map(self::show(...), $record->snapshot ?? [])),
                ]),
        ]);
    }

    /**
     * @return array<string, string>
     */
    private static function changes(AuditEvent $record): array
    {
        $rows = [];

        foreach ($record->changes ?? [] as $field => $pair) {
            $rows[(string) $field] = is_array($pair) && array_is_list($pair) && count($pair) === 2
                ? self::show($pair[0]).' → '.self::show($pair[1])
                : self::show($pair);
        }

        return $rows;
    }

    private static function show(mixed $value): string
    {
        return match (true) {
            $value === null => '—',
            is_bool($value) => $value ? 'sim' : 'não',
            is_scalar($value) => (string) $value,
            is_array($value) && array_is_list($value) && array_filter($value, is_scalar(...)) === $value => implode(', ', $value),
            default => (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        };
    }
}
