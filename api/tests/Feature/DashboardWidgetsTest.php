<?php

use App\Filament\Resources\DriverSubmissions\DriverSubmissionResource;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\DriverSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    signInModerator();
});

it('o painel inicial abre vazio, sem erro', function () {
    $this->get('/moderation')
        ->assertOk()
        ->assertSee('Drivers no catálogo')
        ->assertSee('Envios pendentes')
        ->assertSee('Taxa de aprovação')
        ->assertSee('Envios por dia')
        ->assertSee('Envios por situação')
        ->assertSee('Leituras de manual por dia');
});

it('o painel inicial mostra os números reais', function () {
    Driver::factory()->count(7)->create();
    DriverSubmission::factory()->count(2)->create();
    DriverSubmission::factory()->approved()->count(3)->create();
    DriverSubmission::factory()->rejected()->create();
    config(['manual_extraction.enabled' => true, 'services.openrouter.key' => 'k', 'services.openrouter.model' => 'm', 'manual_extraction.daily_cap' => 20]);
    AuditEvent::factory()->manualRead(true)->count(5)->create();

    $this->get('/moderation')
        ->assertOk()
        ->assertSee('75%')
        ->assertSee('5 de 20 (25%)');
});

it('avisa que a leitura por IA está desativada', function () {
    config(['manual_extraction.enabled' => false]);

    $this->get('/moderation')->assertOk()->assertSee('Leitura por IA desativada');
});

it('o atalho de pendentes leva à lista filtrada em pendentes', function () {
    DriverSubmission::factory()->create();

    $url = DriverSubmissionResource::getUrl('index', ['filters' => ['status' => ['value' => 'pending']]]);

    $this->get('/moderation')->assertOk()->assertSee(e($url), false);
});

it('Painel é o primeiro item da navegação', function () {
    $this->get('/moderation')->assertOk()->assertSeeInOrder(['Painel', 'Envios de drivers', 'Drivers', 'Auditoria']);
});
