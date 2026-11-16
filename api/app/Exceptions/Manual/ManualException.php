<?php

namespace App\Exceptions\Manual;

use RuntimeException;

/** Falha esperada da leitura de manual: vira resposta JSON `{message, code}`. */
abstract class ManualException extends RuntimeException
{
    /**
     * @param  non-empty-string  $reason  chave de `lang/*\/manual.php` e `code` do contrato
     */
    public function __construct(public readonly string $reason, public readonly int $status)
    {
        parent::__construct((string) __("manual.{$reason}"));
    }
}
