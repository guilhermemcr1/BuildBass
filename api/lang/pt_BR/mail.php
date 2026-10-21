<?php

// Aviso da decisão sobre um envio de driver (specs/006, US5). Sai no idioma do envio.
return [
    'approved' => [
        'subject' => 'Seu driver foi aprovado',
        'heading' => 'Driver aprovado',
        'intro' => 'O driver :driver foi aprovado e já pode ser encontrado na busca do catálogo.',
        'outro' => 'Obrigado por contribuir com o catálogo.',
    ],
    'rejected' => [
        'subject' => 'Seu driver não foi aprovado',
        'heading' => 'Driver não aprovado',
        'intro' => 'O driver :driver não foi aprovado desta vez.',
        'reason' => 'Motivo informado pelo moderador:',
        'outro' => 'Você pode enviar uma versão corrigida quando quiser.',
    ],
    'protocol' => 'Protocolo do envio: :protocol',
];
