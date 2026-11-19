<?php

namespace App\Exceptions\Manual;

/** O texto colado não tem nenhuma linha com parâmetro reconhecível. Não consome cota. */
class ManualNoParametersException extends ManualException
{
    public function __construct()
    {
        parent::__construct('no_parameters', 422);
    }
}
