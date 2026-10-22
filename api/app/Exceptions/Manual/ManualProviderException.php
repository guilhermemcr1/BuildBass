<?php

namespace App\Exceptions\Manual;

/** A IA falhou: rede, tempo esgotado, erro do provedor ou resposta fora do schema. */
class ManualProviderException extends ManualException
{
    /**
     * @param  bool  $responded  o provedor chegou a devolver uma resposta HTTP completa (conta no teto diário)
     */
    public function __construct(public readonly bool $responded = false)
    {
        parent::__construct('provider_failed', 502);
    }
}
