<?php

use App\Enums\AuditType;
use App\Filament\Widgets\SubmissionAttemptsChart;
use App\Filament\Widgets\SubmissionSecurityOverview;
use App\Filament\Widgets\SuspiciousIpsTable;
use App\Models\AuditEvent;
use App\Services\DashboardMetrics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

function attemptEvent(AuditType $type, ?string $reason, string $ip, string $ago = '1 hour'): AuditEvent
{
    return AuditEvent::factory()->create([
        'type' => $type,
        'outcome' => $type === AuditType::SubmissionReceived ? 'ok' : 'blocked',
        'reason' => $reason,
        'ip_address' => $ip,
        'created_at' => now()->sub($ago),
    ]);
}

it('resume as tentativas das últimas 24 h por tipo e motivo', function () {
    attemptEvent(AuditType::SubmissionReceived, null, '203.0.113.1');
    attemptEvent(AuditType::SubmissionRefused, 'invalid', '203.0.113.2');
    attemptEvent(AuditType::SubmissionRefused, 'throttled', '203.0.113.2');
    attemptEvent(AuditType::SubmissionRefused, 'duplicate', '203.0.113.4');
    attemptEvent(AuditType::BotBlocked, 'honeypot', '203.0.113.3');
    attemptEvent(AuditType::SubmissionRefused, 'abuse', '203.0.113.3');
    attemptEvent(AuditType::BotBlocked, 'honeypot', '203.0.113.9', '3 days');

    $day = app(DashboardMetrics::class)->submissionAttemptsLastDay();

    expect($day['accepted'])->toBe(1)
        ->and($day['refused'])->toBe(3)
        ->and($day['reasons'])->toEqual(['invalid' => 1, 'throttled' => 1, 'duplicate' => 1])
        ->and($day['bot'])->toBe(1)
        ->and($day['abuse_blocks'])->toBe(1)
        // Driver repetido não torna o IP suspeito.
        ->and($day['suspicious_ips'])->toBe(2);
});

it('lista os IPs mais insistentes da semana, do maior para o menor', function () {
    foreach (range(1, 3) as $n) {
        attemptEvent(AuditType::BotBlocked, 'verification', '198.51.100.7');
    }
    attemptEvent(AuditType::SubmissionRefused, 'invalid', '198.51.100.8');
    attemptEvent(AuditType::SubmissionReceived, null, '198.51.100.9');
    attemptEvent(AuditType::BotBlocked, 'honeypot', '198.51.100.10', '10 days');

    $ips = app(DashboardMetrics::class)->suspiciousIps();

    expect(array_column($ips, 'ip'))->toBe(['198.51.100.7', '198.51.100.8'])
        ->and($ips[0]['attempts'])->toBe(3);
});

it('os widgets de segurança abrem no painel', function () {
    signInModerator();
    attemptEvent(AuditType::BotBlocked, 'honeypot', '198.51.100.7');

    Livewire::test(SubmissionSecurityOverview::class)->assertSee('Barrados pelo anti-robô');
    Livewire::test(SubmissionAttemptsChart::class)->assertOk();
    Livewire::test(SuspiciousIpsTable::class)->assertSee('198.51.100.7');
});
