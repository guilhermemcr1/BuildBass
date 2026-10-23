<?php

// Rótulos da trilha de auditoria do painel (feature 010).
return [

    'types' => [
        'submission_approved' => 'Envio aprovado',
        'submission_rejected' => 'Envio rejeitado',
        'submission_edited' => 'Envio editado',
        'driver_created' => 'Driver criado',
        'driver_updated' => 'Driver atualizado',
        'driver_deleted' => 'Driver excluído',
        'driver_images_changed' => 'Imagens do driver alteradas',
        'login' => 'Entrada no painel',
        'login_failed' => 'Falha de login',
        'logout' => 'Saída do painel',
        'submission_received' => 'Envio recebido',
        'manual_read' => 'Leitura de manual',
        'manual_blocked' => 'Leitura de manual bloqueada',
        'bot_blocked' => 'Bloqueio anti-robô',
    ],

    'outcomes' => [
        'ok' => 'Sucesso',
        'failed' => 'Falha',
        'blocked' => 'Bloqueado',
    ],

    'reasons' => [
        'hourly' => 'Limite por hora',
        'daily' => 'Teto diário',
        'unavailable' => 'Recurso desativado',
        'honeypot' => 'Campo-armadilha',
        'verification' => 'Verificação anti-robô',
        'rejected' => 'Rejeitado pelo moderador',
    ],

];
