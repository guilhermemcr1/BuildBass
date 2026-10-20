<?php

it('responde no endpoint de saúde sem banco configurado', function () {
    $this->get('/up')->assertOk();
});

it('libera o front no CORS do endpoint de saúde', function () {
    $this->withHeaders(['Origin' => 'http://localhost:5173'])
        ->get('/up')
        ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
});
