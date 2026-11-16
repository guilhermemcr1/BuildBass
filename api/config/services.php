<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Captcha invisível dos envios públicos. Desligado fora de produção.
    'turnstile' => [
        'enabled' => (bool) env('TURNSTILE_ENABLED', false),
        'secret' => env('TURNSTILE_SECRET'),
    ],

    // Leitura de manual por IA. Sem chave ou modelo, o recurso fica indisponível.
    'openrouter' => [
        'key' => env('OPENROUTER_API_KEY'),
        'model' => env('OPENROUTER_MODEL'),
        'base_url' => env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
        // `deny` só roteia para provedores que não guardam nem treinam com o texto enviado. Modelos
        // gratuitos quase sempre guardam: com eles, só `allow` acha provedor (404 "No endpoints").
        'data_collection' => env('OPENROUTER_DATA_COLLECTION', 'deny'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
