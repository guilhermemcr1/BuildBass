<?php

use App\Enums\AuditType;
use App\Models\AuditEvent;
use App\Models\DriverSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->withoutDefer();
    config(['abuse.max_strikes' => 3, 'abuse.window_minutes' => 60, 'abuse.block_minutes' => 30]);
});

function trapFrom(string $ip)
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/driver-submissions', ['website' => 'http://spam']);
}

function validFrom(string $ip)
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/driver-submissions', [
        'brand' => 'Marca', 'model' => 'M-1', 'source' => 'Ficha', 'contact_email' => 'pessoa@exemplo.com',
        'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.05, 'locale' => 'pt-BR',
    ]);
}

it('bloqueia o IP depois de max_strikes tentativas suspeitas, com 429 e Retry-After', function () {
    foreach (range(1, 3) as $n) {
        trapFrom('203.0.113.50')->assertCreated();
    }

    validFrom('203.0.113.50')
        ->assertStatus(429)
        ->assertHeader('Retry-After')
        ->assertJsonPath('code', 'too_many_attempts');

    expect(DriverSubmission::count())->toBe(0);
});

it('o bloqueio entra na trilha uma vez só, com o IP', function () {
    foreach (range(1, 3) as $n) {
        trapFrom('203.0.113.50');
    }

    foreach (range(1, 5) as $n) {
        validFrom('203.0.113.50')->assertStatus(429);
    }

    $abuse = AuditEvent::where('type', AuditType::SubmissionRefused)->where('reason', 'abuse')->sole();

    expect($abuse->ip_address)->toBe('203.0.113.50')
        ->and($abuse->outcome)->toBe('blocked')
        ->and($abuse->snapshot['bloqueio_minutos'])->toBe(30)
        // Barrado antes do limite por hora: as tentativas bloqueadas não viram linhas novas.
        ->and(AuditEvent::where('reason', 'throttled')->count())->toBe(0);
});

it('também bloqueia a leitura de manual do mesmo IP', function () {
    foreach (range(1, 3) as $n) {
        trapFrom('203.0.113.50');
    }

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.50'])
        ->post('/api/driver-submissions/extract', ['manual' => manualPdf()], ['Accept' => 'application/json'])
        ->assertStatus(429);
});

it('outro IP segue livre', function () {
    foreach (range(1, 3) as $n) {
        trapFrom('203.0.113.50');
    }

    validFrom('203.0.113.51')->assertCreated();
});

it('o bloqueio acaba depois de block_minutes', function () {
    foreach (range(1, 3) as $n) {
        trapFrom('203.0.113.50');
    }

    $this->travel(31)->minutes();

    validFrom('203.0.113.50')->assertCreated();
});

it('driver repetido não conta falta', function () {
    validFrom('203.0.113.50')->assertCreated();

    foreach (range(1, 3) as $n) {
        validFrom('203.0.113.50')->assertStatus(409);
    }

    expect(AuditEvent::where('reason', 'abuse')->count())->toBe(0);
});
