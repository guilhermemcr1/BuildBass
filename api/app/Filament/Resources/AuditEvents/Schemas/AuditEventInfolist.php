<?php

namespace App\Filament\Resources\AuditEvents\Schemas;

use App\Models\AuditEvent;
use Filament\Infolists\Components\KeyValueEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class AuditEventInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Evento')
                ->columns(3)
                ->schema([
                    TextEntry::make('created_at')->label('Momento')->dateTime('d/m/Y H:i:s'),
                    TextEntry::make('type')->label('Tipo')->badge(),
                    TextEntry::make('outcome')->label('Resultado')
                        ->formatStateUsing(fn (?string $state): ?string => $state === null ? null : (string) __("audit.outcomes.{$state}"))
                        ->placeholder('—'),
                    TextEntry::make('reason')->label('Motivo')->placeholder('—'),
                    TextEntry::make('actor_name')->label('Autor')->placeholder('—'),
                    TextEntry::make('actor_email')->label('E-mail do autor ou digitado')->placeholder('—'),
                    TextEntry::make('subject_label')->label('Objeto')->placeholder('—'),
                    TextEntry::make('subject_id')->label('Identificador do objeto')->placeholder('—'),
                    // Só o hash: o IP nunca é guardado.
                    TextEntry::make('ip_hash')->label('Impressão de rede')
                        ->formatStateUsing(fn (?string $state): ?string => $state === null ? null : substr($state, 0, 12))
                        ->placeholder('—'),
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
            default => (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        };
    }
}
