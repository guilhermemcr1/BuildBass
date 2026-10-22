<?php

namespace App\Exceptions\Manual;

/** O PDF passa dos limites de páginas. Não consome nenhuma cota. */
class ManualInvalidFileException extends ManualException
{
    public function __construct(string $reason = 'too_many_pages')
    {
        parent::__construct($reason, 422);
    }
}
