<?php

namespace App\Filament\Resources\Drivers\Pages;

use App\Filament\Concerns\CancelsWithLink;
use App\Filament\Resources\Drivers\DriverResource;
use App\Filament\Resources\Drivers\Pages\Concerns\HandlesDriverErrors;
use App\Models\Driver;
use App\Models\Moderator;
use App\Services\DriverService;
use Filament\Facades\Filament;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class EditDriver extends EditRecord
{
    use CancelsWithLink;
    use HandlesDriverErrors;

    protected static string $resource = DriverResource::class;

    protected static ?string $title = 'Editar driver';

    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        $moderator = Filament::auth()->user();

        if (! $moderator instanceof Moderator || ! $record instanceof Driver) {
            throw new LogicException('A edição espera um moderador autenticado e um driver.');
        }

        return $this->guardDriverOperation(fn () => app(DriverService::class)->update($record, $data, $moderator));
    }
}
