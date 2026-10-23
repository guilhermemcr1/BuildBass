<?php

namespace App\Exceptions\Manual;

/** Recurso desligado, sem chave/modelo ou com o teto diário atingido. */
class ManualUnavailableException extends ManualException
{
    public function __construct()
    {
        parent::__construct('unavailable', 503);
    }
}
