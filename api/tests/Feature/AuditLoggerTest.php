<?php

use App\Enums\AuditType;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\Moderator;
use App\Services\Audit\AuditLogger;
use App\Support\IpHash;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

uses(RefreshDatabase::class);

it('copia nome e e-mail do moderador no instante do evento', function () {
    $moderator = Moderator::factory()->create(['name' => 'Ana', 'email' => 'ana@exemplo.com']);

    $event = app(AuditLogger::class)->record(AuditType::DriverCreated, ['subject_type' => 'driver'], $moderator);

    expect($event->actor_id)->toBe($moderator->id)
        ->and($event->actor_name)->toBe('Ana')
        ->and($event->actor_email)->toBe('ana@exemplo.com');
});

it('o evento sobrevive à remoção do moderador, com o nome da época', function () {
    $moderator = Moderator::factory()->create(['name' => 'Ana', 'email' => 'ana@exemplo.com']);
    app(AuditLogger::class)->record(AuditType::DriverCreated, [], $moderator);

    $moderator->delete();

    $event = AuditEvent::query()->sole();
    expect($event->actor_name)->toBe('Ana')->and($event->actor_email)->toBe('ana@exemplo.com');
});

it('desfaz o evento junto com a ação quando a transação falha', function () {
    try {
        DB::transaction(function () {
            app(AuditLogger::class)->record(AuditType::DriverDeleted);

            throw new RuntimeException('falhou depois');
        });
    } catch (RuntimeException) {
    }

    expect(AuditEvent::count())->toBe(0);
});

it('grava o IP em claro na coluna própria e em hash, sem repetir em outro campo', function () {
    app(AuditLogger::class)->record(AuditType::Login, ['ip' => '203.0.113.9']);

    $event = AuditEvent::query()->sole();

    expect($event->ip_hash)->toBe(IpHash::make('203.0.113.9'))
        ->and($event->ip_address)->toBe('203.0.113.9')
        ->and(str_contains((string) json_encode(Arr::except($event->getAttributes(), ['ip_address'])), '203.0.113.9'))->toBeFalse();
});

it('descarta um IP malformado em vez de gravá-lo', function () {
    app(AuditLogger::class)->record(AuditType::Login, ['ip' => '<script>']);

    $event = AuditEvent::query()->sole();

    expect($event->ip_address)->toBeNull()->and($event->ip_hash)->toBeNull();
});

it('grava o evento público depois da resposta, com o IP em hash', function () {
    $this->withoutDefer();

    app(AuditLogger::class)->recordDeferred(AuditType::BotBlocked, ['outcome' => 'blocked', 'reason' => 'honeypot'], '203.0.113.9');

    $event = AuditEvent::query()->sole();
    expect($event->reason)->toBe('honeypot')->and($event->ip_hash)->toBe(IpHash::make('203.0.113.9'));
});

it('engole a falha ao gravar um evento público e não vaza dados no log', function () {
    $this->withoutDefer();
    Log::spy();
    DB::statement('DROP TABLE audit_events');

    app(AuditLogger::class)->recordDeferred(AuditType::BotBlocked, [], '203.0.113.9');

    Log::shouldHaveReceived('warning')->once()->withArgs(function (string $message, array $context): bool {
        return ! str_contains(json_encode($context), '203.0.113.9') && $context['type'] === 'bot_blocked';
    });
});

it('monta o rótulo do driver com a variante entre parênteses', function () {
    $logger = app(AuditLogger::class);

    expect($logger->driverLabel(new Driver(['brand' => 'Triton', 'model' => 'TR 620', 'variant' => ''])))
        ->toBe('Triton TR 620')
        ->and($logger->driverLabel(new Driver(['brand' => 'Triton', 'model' => 'TR 620', 'variant' => '4 ohm'])))
        ->toBe('Triton TR 620 (4 ohm)');
});
