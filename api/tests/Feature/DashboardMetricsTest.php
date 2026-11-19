<?php

use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Services\DashboardMetrics;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->travelTo('2026-10-22 15:00:00');
    config(['manual_extraction.daily_cap' => 10]);
});

it('conta envios por dia nos últimos 30 dias, com dias vazios em zero', function () {
    DriverSubmission::factory()->count(2)->create(['created_at' => '2026-10-22 08:00:00']);
    DriverSubmission::factory()->create(['created_at' => '2026-10-20 23:59:00']);
    DriverSubmission::factory()->create(['created_at' => '2026-09-01 10:00:00']); // fora da janela

    $days = app(DashboardMetrics::class)->submissionsPerDay();

    expect($days)->toHaveCount(30)
        ->and(array_key_first($days))->toBe('2026-09-23')
        ->and(array_key_last($days))->toBe('2026-10-22')
        ->and($days['2026-10-22'])->toBe(2)
        ->and($days['2026-10-21'])->toBe(0)
        ->and($days['2026-10-20'])->toBe(1)
        ->and(array_sum($days))->toBe(3);
});

it('divide os envios por situação e calcula a taxa de aprovação', function () {
    DriverSubmission::factory()->count(2)->create();
    DriverSubmission::factory()->approved()->count(3)->create();
    DriverSubmission::factory()->rejected()->count(1)->create();

    $metrics = app(DashboardMetrics::class);

    expect($metrics->submissionsByStatus())->toBe(['pending' => 2, 'approved' => 3, 'rejected' => 1])
        ->and($metrics->approvalRate())->toBe(0.75)
        ->and($metrics->pending())->toBe(2);
});

it('taxa de aprovação é nula sem decisões', function () {
    DriverSubmission::factory()->count(2)->create();

    expect(app(DashboardMetrics::class)->approvalRate())->toBeNull();
});

it('resume o uso da IA hoje e em 30 dias, com a cota do dia', function () {
    AuditEvent::factory()->manualRead(true)->count(3)->create(['created_at' => now()->subHour()]);
    AuditEvent::factory()->manualRead(false)->create(['outcome' => 'failed', 'reason' => 'unreadable', 'created_at' => now()->subHour()]);
    AuditEvent::factory()->manualBlocked('hourly')->count(2)->create(['created_at' => now()->subHour()]);
    // Ontem: entra nos 30 dias, não em "hoje" nem na cota de hoje.
    AuditEvent::factory()->manualRead(true)->create(['created_at' => now()->subDay()]);
    // Fora de 30 dias.
    AuditEvent::factory()->manualRead(true)->create(['created_at' => now()->subDays(40)]);

    $usage = app(DashboardMetrics::class)->manualUsage();

    expect($usage['enabled'])->toBeBool()
        ->and($usage['today'])->toBe(['reads' => 3, 'failures' => 1, 'blocked' => 2])
        ->and($usage['days30'])->toBe(['reads' => 4, 'failures' => 1, 'blocked' => 2])
        ->and($usage['quota_used'])->toBe(3)
        ->and($usage['quota_cap'])->toBe(10)
        ->and($usage['quota_percent'])->toBe(30.0);
});

it('lê a cota só dos eventos do dia local (meia-noite de Brasília = 03:00 UTC)', function () {
    config(['app.display_timezone' => 'America/Sao_Paulo']);
    AuditEvent::factory()->manualRead(true)->create(['created_at' => '2026-10-22 02:59:59']);
    AuditEvent::factory()->manualRead(true)->create(['created_at' => '2026-10-22 03:00:00']);

    expect(app(DashboardMetrics::class)->manualUsage()['quota_used'])->toBe(1);
});

it('informa a IA desativada', function () {
    config(['manual_extraction.enabled' => false]);

    expect(app(DashboardMetrics::class)->manualUsage()['enabled'])->toBeFalse();
});

it('leituras por dia separam ok, falha e bloqueio, com zeros nos dias vazios', function () {
    AuditEvent::factory()->manualRead(true)->count(2)->create(['created_at' => '2026-10-22 09:00:00']);
    AuditEvent::factory()->manualRead(false)->create(['outcome' => 'failed', 'created_at' => '2026-10-22 10:00:00']);
    AuditEvent::factory()->manualBlocked('daily')->create(['created_at' => '2026-10-21 10:00:00']);

    $series = app(DashboardMetrics::class)->manualReadsPerDay();

    expect($series['ok'])->toHaveCount(30)
        ->and($series['ok']['2026-10-22'])->toBe(2)
        ->and($series['failed']['2026-10-22'])->toBe(1)
        ->and($series['blocked']['2026-10-21'])->toBe(1)
        ->and($series['blocked']['2026-10-22'])->toBe(0)
        ->and($series['ok']['2026-10-01'])->toBe(0);
});

it('total de drivers e base vazia sem erro', function () {
    $metrics = app(DashboardMetrics::class);

    expect($metrics->driversTotal())->toBe(0)
        ->and($metrics->pending())->toBe(0)
        ->and($metrics->approvalRate())->toBeNull()
        ->and($metrics->submissionsByStatus())->toBe(['pending' => 0, 'approved' => 0, 'rejected' => 0])
        ->and(array_sum($metrics->submissionsPerDay()))->toBe(0)
        ->and($metrics->manualUsage()['quota_used'])->toBe(0);

    Driver::factory()->count(4)->create();
    expect($metrics->driversTotal())->toBe(4);
});

it('o dia do painel é o local: envio às 22h de Brasília conta no mesmo dia, não no seguinte', function () {
    config(['app.display_timezone' => 'America/Sao_Paulo']);
    $this->travelTo('2026-10-23 02:30:00'); // 23:30 do dia 22 em Brasília
    // 01:00 UTC do dia 23 = 22:00 do dia 22 em Brasília.
    DriverSubmission::factory()->create(['created_at' => '2026-10-23 01:00:00']);
    // 02:00 UTC do dia 22 = 23:00 do dia 21 em Brasília.
    DriverSubmission::factory()->create(['created_at' => '2026-10-22 02:00:00']);

    $days = app(DashboardMetrics::class)->submissionsPerDay();

    expect(array_key_last($days))->toBe('2026-10-22')
        ->and($days['2026-10-22'])->toBe(1)
        ->and($days['2026-10-21'])->toBe(1);
});

it('a cota de hoje do painel vira à meia-noite local', function () {
    config(['app.display_timezone' => 'America/Sao_Paulo']);
    $this->travelTo('2026-10-23 02:30:00'); // 23:30 do dia 22 em Brasília
    // 22:00 de Brasília, ainda hoje no horário local.
    AuditEvent::factory()->manualRead(true)->create(['created_at' => '2026-10-23 01:00:00']);
    // 20:00 de Brasília do dia 21: ontem.
    AuditEvent::factory()->manualRead(true)->create(['created_at' => '2026-10-21 23:00:00']);

    $usage = app(DashboardMetrics::class)->manualUsage();

    expect($usage['quota_used'])->toBe(1)
        ->and($usage['today']['reads'])->toBe(1);
});
