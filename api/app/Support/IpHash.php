<?php

namespace App\Support;

class IpHash
{
    /**
     * Impressão irreversível do IP: HMAC-SHA256 com a chave do app. Estável, então serve para
     * agrupar envios do mesmo remetente; sem a chave, não dá para voltar ao endereço.
     */
    public static function make(string $ip): string
    {
        return hash_hmac('sha256', $ip, (string) config('app.key'));
    }
}
