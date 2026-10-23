<?php

namespace App\Exceptions;

use RuntimeException;

/** Imagem recusada (formato, tamanho, dimensões, arquivo ilegível). `reason` é chave de `lang/*\/driver_images.php`. */
class DriverImageException extends RuntimeException
{
    /**
     * @param  non-empty-string  $reason
     */
    public function __construct(public readonly string $reason)
    {
        parent::__construct((string) __("driver_images.{$reason}"));
    }
}
