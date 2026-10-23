<?php

namespace App\Filament\Resources\Drivers\Pages;

use App\Filament\Concerns\CancelsWithLink;
use App\Filament\Resources\Drivers\DriverResource;
use App\Filament\Resources\Drivers\Pages\Concerns\FillsFromManual;
use App\Filament\Resources\Drivers\Pages\Concerns\HandlesDriverErrors;
use App\Models\Moderator;
use App\Services\DriverService;
use Filament\Facades\Filament;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class CreateDriver extends CreateRecord
{
    use CancelsWithLink;
    use FillsFromManual;
    use HandlesDriverErrors;

    protected static string $resource = DriverResource::class;

    protected static ?string $title = 'Novo driver';

    protected function getHeaderActions(): array
    {
        return [$this->readManualAction()];
    }

    protected function handleRecordCreation(array $data): Model
    {
        $moderator = Filament::auth()->user();

        if (! $moderator instanceof Moderator) {
            throw new LogicException('O painel de moderação espera um moderador autenticado.');
        }

        return $this->guardDriverOperation(fn () => app(DriverService::class)->create($data, $moderator));
    }
}
