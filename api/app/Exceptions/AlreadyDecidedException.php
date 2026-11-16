<?php

namespace App\Exceptions;

use RuntimeException;

/** O envio já foi aprovado ou rejeitado: cada envio é decidido uma única vez. */
class AlreadyDecidedException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Este envio já foi decidido.');
    }
}
