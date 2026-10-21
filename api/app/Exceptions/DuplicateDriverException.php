<?php

namespace App\Exceptions;

use RuntimeException;

/** Já existe no catálogo um driver com o mesmo fabricante, modelo e variante. */
class DuplicateDriverException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Já existe no catálogo um driver com o mesmo fabricante, modelo e variante.');
    }
}
