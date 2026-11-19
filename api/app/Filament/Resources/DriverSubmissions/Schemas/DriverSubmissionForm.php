<?php

namespace App\Filament\Resources\DriverSubmissions\Schemas;

use App\Enums\SubmissionStatus;
use App\Filament\Schemas\DriverDimensionFields;
use App\Filament\Schemas\DriverParameterFields;
use App\Filament\Schemas\IdentityFields;
use App\Models\Driver;
use App\Models\DriverSubmission;
use Filament\Forms\Components\Select;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

class DriverSubmissionForm
{
    public static function configure(Schema $schema): Schema
    {
        $editable = fn (?DriverSubmission $record): bool => $record?->status === SubmissionStatus::Pending;

        $locked = fn (?DriverSubmission $record): bool => ! $editable($record);

        $parameters = DriverParameterFields::groups($locked);

        return $schema->columns(1)->components([
            Section::make('Identificação')
                ->icon(Heroicon::OutlinedIdentification)
                ->columns(['default' => 1, 'md' => 2, 'xl' => 4])
                ->schema([
                    IdentityFields::brand()->disabled($locked),
                    IdentityFields::model()->disabled($locked),
                    IdentityFields::variant($locked),
                    Select::make('type')->label('Tipo')
                        ->options(array_combine(Driver::TYPES, array_map('ucfirst', Driver::TYPES)))
                        ->placeholder('Não informado')
                        ->disabled(fn (?DriverSubmission $record): bool => ! $editable($record)),
                ]),
            Section::make('Parâmetros Thiele-Small')
                ->description('Unidades do SI, ponto nos decimais. Confira com a fonte informada.')
                ->icon(Heroicon::OutlinedAdjustmentsHorizontal)
                ->schema($parameters),
            Section::make('Dimensões')
                ->description('Opcionais. Seguem para o catálogo ao aprovar.')
                ->icon(Heroicon::OutlinedViewfinderCircle)
                ->collapsible()
                ->schema(DriverDimensionFields::make())
                ->disabled($locked),
            Section::make('Origem dos dados')
                ->icon(Heroicon::OutlinedDocumentText)
                ->schema([
                    IdentityFields::source()->disabled($locked),
                ]),
            Section::make('Remetente e decisão')
                ->icon(Heroicon::OutlinedUserCircle)
                ->columns(['default' => 1, 'md' => 2, 'xl' => 3])
                ->schema([
                    TextEntry::make('locale')->label('Idioma do envio'),
                    TextEntry::make('sender')
                        ->label('Impressão de rede')
                        ->state(fn (?DriverSubmission $record): string => $record === null ? '' : substr($record->ip_hash, 0, 8)),
                    TextEntry::make('email_state')
                        ->label('E-mail para aviso')
                        ->state(fn (?DriverSubmission $record): string => $record?->contact_email === null
                            ? 'Não informado'
                            : 'Informado (usado só para avisar a decisão)'),
                    TextEntry::make('decided_by_name')
                        ->label('Decidido por')
                        ->state(fn (?DriverSubmission $record): ?string => $record?->decidedBy?->name)
                        ->placeholder('—'),
                    TextEntry::make('decided_at')->label('Decidido em')->dateTime('d/m/Y H:i')->placeholder('—'),
                    TextEntry::make('rejection_reason')->label('Motivo da rejeição')->placeholder('—'),
                ]),
        ]);
    }
}
