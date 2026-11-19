<?php

// Leitura assistida de manual de driver: o PDF vira texto no servidor (poppler) e só o
// texto segue para a IA. Nada é gravado. Os limites valem em qualquer ambiente.
return [

    'enabled' => (bool) env('MANUAL_EXTRACTION_ENABLED', false),

    // Análises por IP por hora e teto diário global (soft cap: pode passar por poucas concorrentes).
    'hourly_limit' => (int) env('MANUAL_EXTRACTION_HOURLY_LIMIT', 3),
    'daily_cap' => (int) env('MANUAL_EXTRACTION_DAILY_CAP', 200),

    // Arquivo: tamanho em KB, páginas e texto (caracteres) enviados à IA.
    'max_kb' => 10240,
    'max_pages' => 30,
    'max_chars' => 60000,
    'min_chars' => 200,

    // Texto colado (alternativa ao PDF): o que o servidor aceita receber, e o que sobra do filtro
    // (só linhas com parâmetro) para a IA. O front aplica o mesmo `text_max_input`.
    'text_max_input' => 4000,
    'text_max_lines' => 60,
    'text_max_line' => 160,
    'text_max_chars' => 3000,

    'binaries' => [
        'pdftotext' => env('PDFTOTEXT_BIN', 'pdftotext'),
        'pdfinfo' => env('PDFINFO_BIN', 'pdfinfo'),
    ],

    // Teto de tokens da resposta da IA (a lista de drivers é curta; o resto é folga para raciocínio).
    'max_output_tokens' => (int) env('MANUAL_EXTRACTION_MAX_OUTPUT_TOKENS', 8000),

    // Segundos.
    'process_timeout' => 20,
    'provider_timeout' => 45,

];
