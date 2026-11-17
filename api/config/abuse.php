<?php

// Envios públicos suspeitos (anti-robô reprovado, validação recusada, limite estourado): cada um é
// uma falta do IP. Com `max_strikes` faltas dentro de `window_minutes`, o IP fica bloqueado nos
// envios e na leitura de manual por `block_minutes`.
return [

    'max_strikes' => (int) env('ABUSE_MAX_STRIKES', 10),

    'window_minutes' => (int) env('ABUSE_WINDOW_MINUTES', 60),

    'block_minutes' => (int) env('ABUSE_BLOCK_MINUTES', 360),

];
