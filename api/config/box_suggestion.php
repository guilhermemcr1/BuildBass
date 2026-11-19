<?php

// Sugestão de caixa por IA: o front manda os parâmetros do alto-falante e o objetivo; a IA devolve
// candidatos (tipo, Vb, Fb, duto) que o motor do front simula antes de mostrar. Nada é gravado.
return [

    'enabled' => (bool) env('BOX_SUGGESTION_ENABLED', false),

    // Modelo próprio, se quiser um diferente da leitura de manual; vazio usa OPENROUTER_MODEL.
    'model' => env('BOX_SUGGESTION_MODEL'),

    // Pedidos por IP por hora e teto diário global (soft cap: pode passar por poucas concorrentes).
    'hourly_limit' => (int) env('BOX_SUGGESTION_HOURLY_LIMIT', 8),
    'daily_cap' => (int) env('BOX_SUGGESTION_DAILY_CAP', 50),

    // Teto de tokens da resposta (os candidatos são curtos; o resto é folga para raciocínio).
    'max_output_tokens' => (int) env('BOX_SUGGESTION_MAX_OUTPUT_TOKENS', 6000),

    // Segundos.
    'provider_timeout' => 45,

];
