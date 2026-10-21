<?php

namespace App\Filament\Resources\DriverSubmissions;

use App\Filament\Resources\DriverSubmissions\Pages\EditDriverSubmission;
use App\Filament\Resources\DriverSubmissions\Pages\ListDriverSubmissions;
use App\Filament\Resources\DriverSubmissions\Schemas\DriverSubmissionForm;
use App\Filament\Resources\DriverSubmissions\Tables\DriverSubmissionsTable;
use App\Models\DriverSubmission;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class DriverSubmissionResource extends Resource
{
    protected static ?string $model = DriverSubmission::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedInboxArrowDown;

    protected static ?string $slug = 'envios';

    protected static ?string $modelLabel = 'envio de driver';

    protected static ?string $pluralModelLabel = 'Envios de drivers';

    protected static ?string $navigationLabel = 'Envios de drivers';

    public static function form(Schema $schema): Schema
    {
        return DriverSubmissionForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return DriverSubmissionsTable::configure($table);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListDriverSubmissions::route('/'),
            'edit' => EditDriverSubmission::route('/{record}/revisar'),
        ];
    }

    // Os envios chegam só pela API pública; o painel decide, não cria nem apaga.
    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function canDeleteAny(): bool
    {
        return false;
    }
}
