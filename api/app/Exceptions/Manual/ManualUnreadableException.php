<?php

namespace App\Exceptions\Manual;

/** O PDF não tem texto legível: escaneado, vazio, protegido ou corrompido. */
class ManualUnreadableException extends ManualException
{
    public function __construct()
    {
        parent::__construct('unreadable', 422);
    }
}
