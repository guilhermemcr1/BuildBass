<?php

// Rótulos da trilha de auditoria do painel.
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
        'submission_refused' => 'Envio recusado',
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
        'verification_unreachable' => 'Verificação anti-robô fora do ar',
        'throttled' => 'Limite de envios por hora',
        'invalid' => 'Dados inválidos',
        'duplicate' => 'Driver repetido',
        'abuse' => 'IP bloqueado por tentativas suspeitas',
        'provider_failed' => 'Falha no provedor de IA',
        'unreadable' => 'PDF ilegível',
        'too_many_pages' => 'PDF com páginas demais',
        'rate_limited' => 'Limite de uso',
        'rejected' => 'Rejeitado pelo moderador',
    ],

];
