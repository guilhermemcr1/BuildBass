<?php

namespace App\Filament\Concerns;

use Filament\Actions\Action;

/**
 * "Cancelar" como link comum para a lista, no lugar do botão do Filament que volta no histórico por
 * JavaScript. Sendo um link, o Dialog de alterações não salvas (resources/views/filament/
 * unsaved-guard.blade.php) o intercepta como qualquer outro, e o popup do navegador não aparece.
 */
trait CancelsWithLink
{
    protected function getCancelFormAction(): Action
    {
        return Action::make('cancel')
            ->label('Cancelar')
            ->url($this->previousUrl ?? $this->getResourceUrl())
            ->color('gray');
    }
}
