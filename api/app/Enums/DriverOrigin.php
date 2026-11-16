<?php

namespace App\Enums;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

/** Como o driver entrou no catálogo. Não é editável. */
enum DriverOrigin: string implements HasColor, HasLabel
{
    case InitialLoad = 'initial_load';
    case ApprovedSubmission = 'approved_submission';
    case Direct = 'direct';

    public function label(): string
    {
        return match ($this) {
            self::InitialLoad => 'Carga inicial',
            self::ApprovedSubmission => 'Envio aprovado',
            self::Direct => 'Cadastro direto',
        };
    }

    public function getLabel(): string
    {
        return $this->label();
    }

    public function getColor(): string
    {
        return match ($this) {
            self::InitialLoad => 'gray',
            self::ApprovedSubmission => 'success',
            self::Direct => 'info',
        };
    }
}
