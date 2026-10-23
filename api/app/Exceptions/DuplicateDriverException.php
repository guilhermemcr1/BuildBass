<?php

namespace App\Exceptions;

use RuntimeException;

/** Já existe no catálogo um driver com o mesmo fabricante, modelo e variante. */
class DuplicateDriverException extends RuntimeException
{
    public function __construct(?string $existing = null)
    {
        $message = 'Já existe no catálogo um driver com o mesmo fabricante, modelo e variante';

        parent::__construct($existing === null ? $message.'.' : "{$message}: {$existing}.");
    }
}
