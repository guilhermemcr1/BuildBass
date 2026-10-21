<?php

use App\Models\Driver;
use App\Models\DriverSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('nenhuma leitura pública mostra e-mail, hash, chave de duplicata ou envio não aprovado', function () {
    $submission = DriverSubmission::factory()->create([
        'brand' => 'Pendente', 'model' => 'P-1', 'contact_email' => 'pessoa@exemplo.com',
    ]);
    $driver = Driver::factory()->create(['brand' => 'Publicado', 'model' => 'D-1']);

    $bodies = [
        $this->getJson('/api/drivers?q=pendente')->getContent(),
        $this->getJson('/api/drivers?q=publicado')->getContent(),
        $this->getJson("/api/drivers/{$driver->id}")->getContent(),
    ];

    foreach ($bodies as $body) {
        expect($body)->not->toContain('pessoa@exemplo.com')
            ->not->toContain($submission->ip_hash)
            ->not->toContain('dedupe_key')
            ->not->toContain('ip_hash')
            ->not->toContain('contact_email');
    }

    $this->getJson('/api/drivers?q=pendente')->assertJsonCount(0, 'data');
});

it('o driver aprovado não carrega campos do envio', function () {
    $driver = Driver::factory()->create();

    $keys = array_keys($this->getJson("/api/drivers/{$driver->id}")->json('data'));

    expect($keys)->not->toContain('status')
        ->not->toContain('locale')
        ->not->toContain('decided_by')
        ->not->toContain('rejection_reason');
});

it('a resposta do envio só traz protocolo e situação', function () {
    $this->postJson('/api/driver-submissions', [
        'brand' => 'Marca', 'model' => 'M-1', 'source' => 'Ficha',
        'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.05, 'contact_email' => 'pessoa@exemplo.com',
    ])->assertCreated()->assertJsonStructure(['data' => ['protocol', 'status']])
        ->assertJsonCount(2, 'data');
});
