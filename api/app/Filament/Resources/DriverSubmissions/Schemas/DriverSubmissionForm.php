<?php

namespace App\Filament\Resources\DriverSubmissions\Schemas;

use App\Enums\SubmissionStatus;
use App\Models\Driver;
use App\Models\DriverSubmission;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class DriverSubmissionForm
{
    /** Rótulos dos parâmetros, na ordem em que o moderador confere. */
    private const PARAMETER_LABELS = [
        'fs_hz' => 'Fs (Hz)',
        'qts' => 'Qts',
        'vas_m3' => 'Vas (m³)',
        'qes' => 'Qes',
        'qms' => 'Qms',
        're_ohm' => 'Re (Ω)',
        'le_h' => 'Le (H)',
        'xmax_m' => 'Xmax (m)',
        'sd_m2' => 'Sd (m²)',
        'pe_w' => 'Pe (W)',
        'bl_tm' => 'BL (T·m)',
        'mms_kg' => 'Mms (kg)',
        'vd_m3' => 'Vd (m³)',
        'nominal_diameter_m' => 'Diâmetro nominal (m)',
    ];

    public static function configure(Schema $schema): Schema
    {
        $editable = fn (?DriverSubmission $record): bool => $record?->status === SubmissionStatus::Pending;

        $parameters = [];

        foreach (self::PARAMETER_LABELS as $key => $label) {
            [$min, $max] = Driver::RANGES[$key];

            $parameters[] = TextInput::make($key)
                ->label($label)
                ->numeric()
                ->step('any')
                ->minValue($min)
                ->maxValue($max)
                ->required(in_array($key, Driver::REQUIRED_PARAMETERS, true))
                ->disabled(fn (?DriverSubmission $record): bool => ! $editable($record));
        }

        return $schema->components([
            Section::make('Identificação')
                ->columns(3)
                ->schema([
                    TextInput::make('brand')->label('Fabricante')->required()->maxLength(80)
                        ->disabled(fn (?DriverSubmission $record): bool => ! $editable($record)),
                    TextInput::make('model')->label('Modelo')->required()->maxLength(80)
                        ->disabled(fn (?DriverSubmission $record): bool => ! $editable($record)),
                    TextInput::make('variant')->label('Variante')->maxLength(40)
                        ->disabled(fn (?DriverSubmission $record): bool => ! $editable($record)),
                ]),
            Section::make('Parâmetros (SI)')
                ->columns(4)
                ->schema($parameters),
            Section::make('Origem dos dados')
                ->schema([
                    TextInput::make('source')->label('Fonte')->required()->maxLength(255)
                        ->disabled(fn (?DriverSubmission $record): bool => ! $editable($record)),
                ]),
            Section::make('Remetente e decisão')
                ->columns(3)
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
