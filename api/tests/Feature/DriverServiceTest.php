<?php

use App\Enums\AuditType;
use App\Enums\DriverOrigin;
use App\Exceptions\DuplicateDriverException;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\Audit\AuditLogger;
use App\Services\DriverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

/** @return array<string, mixed> */
function driverData(array $overrides = []): array
{
    return array_merge(Driver::factory()->make(['brand' => 'Triton', 'model' => 'TR 620'])->only([
        'brand', 'model', 'variant', 'type', 'nominal_diameter_m', 'fs_hz', 'qts', 'vas_m3', 'qes', 'qms',
        're_ohm', 'le_h', 'xmax_m', 'sd_m2', 'pe_w', 'bl_tm', 'mms_kg', 'vd_m3', 'source',
    ]), $overrides);
}

it('cria o driver com origem de cadastro direto e grava driver_created com o snapshot', function () {
    $moderator = Moderator::factory()->create();

    $driver = app(DriverService::class)->create(driverData(), $moderator);

    $event = AuditEvent::query()->sole();
    expect($driver->fresh()->origin)->toBe(DriverOrigin::Direct)
        ->and($event->type)->toBe(AuditType::DriverCreated)
        ->and($event->actor_id)->toBe($moderator->id)
        ->and($event->subject_id)->toBe($driver->id)
        ->and($event->subject_label)->toBe('Triton TR 620')
        ->and($event->snapshot['brand'])->toBe('Triton')
        ->and($event->snapshot['origin'])->toBe('direct');
});

it('atualiza e grava driver_updated com antes e depois', function () {
    $moderator = Moderator::factory()->create();
    $driver = Driver::factory()->create(['qts' => 0.4]);

    app(DriverService::class)->update($driver, ['qts' => 0.5], $moderator);

    $event = AuditEvent::query()->sole();
    expect($driver->fresh()->qts)->toBe(0.5)
        ->and($event->type)->toBe(AuditType::DriverUpdated)
        ->and($event->changes)->toBe(['qts' => [0.4, 0.5]]);
});

it('não grava evento quando nada mudou', function () {
    $moderator = Moderator::factory()->create();
    $driver = Driver::factory()->create();

    app(DriverService::class)->update($driver, $driver->only(['brand', 'qts', 'variant']), $moderator);

    expect(AuditEvent::count())->toBe(0);
});

it('exclui, grava driver_deleted com o conteúdo e solta o vínculo do envio aprovado', function () {
    $moderator = Moderator::factory()->create();
    $driver = Driver::factory()->create(['brand' => 'Triton', 'model' => 'TR 620']);
    $submission = DriverSubmission::factory()->approved()->create(['driver_id' => $driver->id]);

    app(DriverService::class)->delete($driver, $moderator);

    $event = AuditEvent::query()->sole();
    expect(Driver::count())->toBe(0)
        ->and($submission->fresh()->driver_id)->toBeNull()
        ->and($event->type)->toBe(AuditType::DriverDeleted)
        ->and($event->snapshot['model'])->toBe('TR 620')
        ->and($event->subject_label)->toBe('Triton TR 620');
});

it('recusa a tripla repetida e o mesmo nome normalizado, citando o driver existente', function () {
    $moderator = Moderator::factory()->create();
    Driver::factory()->create(['brand' => 'Triton', 'model' => 'TR 620', 'variant' => '']);

    expect(fn () => app(DriverService::class)->create(driverData(), $moderator))
        ->toThrow(DuplicateDriverException::class, 'Triton TR 620');

    expect(fn () => app(DriverService::class)->create(driverData(['brand' => 'TRÍTON ']), $moderator))
        ->toThrow(DuplicateDriverException::class);

    expect(Driver::count())->toBe(1)->and(AuditEvent::count())->toBe(0);
});

it('na edição ignora o próprio driver mas recusa colidir com outro', function () {
    $moderator = Moderator::factory()->create();
    $mine = Driver::factory()->create(['brand' => 'Triton', 'model' => 'TR 620']);
    Driver::factory()->create(['brand' => 'Triton', 'model' => 'TR 800']);

    app(DriverService::class)->update($mine, ['source' => 'Outra fonte'], $moderator);

    expect(fn () => app(DriverService::class)->update($mine, ['model' => 'TR 800'], $moderator))
        ->toThrow(DuplicateDriverException::class);
});

it('trata variante vazia como sem variante', function () {
    $moderator = Moderator::factory()->create();

    $driver = app(DriverService::class)->create(driverData(['variant' => null]), $moderator);

    expect($driver->fresh()->variant)->toBe('');
});

it('recusa fora das faixas físicas, em todas as faixas, e sem Fs, Qts ou Vas', function () {
    $moderator = Moderator::factory()->create();

    foreach (Driver::RANGES as $key => [$min, $max]) {
        foreach ([$min - ($min > 0 ? $min / 2 : 0.001), $max * 2 + 1] as $invalid) {
            expect(fn () => app(DriverService::class)->create(driverData([$key => $invalid, 'model' => "X {$key}"]), $moderator))
                ->toThrow(ValidationException::class, '', "{$key} = {$invalid}");
        }
    }

    foreach (Driver::REQUIRED_PARAMETERS as $key) {
        expect(fn () => app(DriverService::class)->create(driverData([$key => null]), $moderator))
            ->toThrow(ValidationException::class);
    }

    expect(Driver::count())->toBe(0);
});

it('aceita os limites exatos das faixas', function () {
    $moderator = Moderator::factory()->create();

    foreach (Driver::RANGES as $key => [$min, $max]) {
        app(DriverService::class)->create(driverData([$key => $min, 'model' => "Min {$key}"]), $moderator);
        app(DriverService::class)->create(driverData([$key => $max, 'model' => "Max {$key}"]), $moderator);
    }

    expect(Driver::count())->toBe(count(Driver::RANGES) * 2);
});

it('recusa tipo desconhecido e textos acima do limite', function () {
    $moderator = Moderator::factory()->create();

    expect(fn () => app(DriverService::class)->create(driverData(['type' => 'tweeter']), $moderator))
        ->toThrow(ValidationException::class)
        ->and(fn () => app(DriverService::class)->create(driverData(['brand' => str_repeat('a', 81)]), $moderator))
        ->toThrow(ValidationException::class)
        ->and(fn () => app(DriverService::class)->create(driverData(['variant' => str_repeat('a', 41)]), $moderator))
        ->toThrow(ValidationException::class)
        ->and(fn () => app(DriverService::class)->create(driverData(['source' => str_repeat('a', 256)]), $moderator))
        ->toThrow(ValidationException::class);
});

it('desfaz a mudança quando o registro de auditoria falha', function () {
    $moderator = Moderator::factory()->create();
    $driver = Driver::factory()->create(['qts' => 0.4]);
    $this->mock(AuditLogger::class, function ($mock) {
        $mock->shouldReceive('driverLabel')->andReturn('x');
        $mock->shouldReceive('record')->andThrow(new RuntimeException('auditoria fora do ar'));
    });

    expect(fn () => app(DriverService::class)->update($driver, ['qts' => 0.9], $moderator))
        ->toThrow(RuntimeException::class)
        ->and(fn () => app(DriverService::class)->delete($driver, $moderator))
        ->toThrow(RuntimeException::class)
        ->and(fn () => app(DriverService::class)->create(driverData(), $moderator))
        ->toThrow(RuntimeException::class);

    expect($driver->fresh()->qts)->toBe(0.4)
        ->and(Driver::count())->toBe(1);
});
