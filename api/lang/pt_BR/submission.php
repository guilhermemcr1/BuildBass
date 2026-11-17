<?php

// Mensagens de validação do envio de driver. O app mostra textos próprios por
// campo; estas servem a quem chama a API direto.
return [
    'required' => 'Preencha este campo.',
    'string' => 'Informe um texto.',
    'numeric' => 'Informe um número.',
    'between' => 'Valor fora da faixa permitida (de :min a :max).',
    'max' => 'Use no máximo :max caracteres.',
    'min' => 'Preencha este campo.',
    'email' => 'Informe um e-mail válido.',
    'in' => 'Escolha um dos tipos disponíveis.',
    'impedance' => 'Informe só a impedância em ohms, de :min a :max (ex.: 4 ou 3,2).',
    'honeypot' => 'Requisição recusada.',
    'duplicate_in_catalog' => 'Este driver já está no catálogo.',
    'duplicate_pending' => 'Este driver já está em análise.',
    'verification_failed' => 'Não foi possível confirmar que você não é um robô. Tente de novo.',
    'blocked' => 'Muitas tentativas recusadas deste endereço. Tente de novo mais tarde.',
    'throttled' => 'Muitos envios em pouco tempo. Tente de novo mais tarde.',
];
