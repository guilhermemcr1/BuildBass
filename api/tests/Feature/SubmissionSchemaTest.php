<?php

use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('cria as tabelas do envio e do moderador', function () {
    expect(Schema::hasTable('driver_submissions'))->toBeTrue()
        ->and(Schema::hasTable('moderators'))->toBeTrue();
});

it('usa UUID como chave primária', function () {
    $submission = DriverSubmission::factory()->create();
    $moderator = Moderator::factory()->create();

    expect($submission->id)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/')
        ->and($moderator->id)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/');
});

it('não tem coluna para o IP em claro', function () {
    $columns = Schema::getColumnListing('driver_submissions');

    expect($columns)->toContain('ip_hash')
        ->and($columns)->not->toContain('ip')
        ->and($columns)->not->toContain('ip_address');
});

it('grava a chave de duplicata normalizada', function () {
    $submission = DriverSubmission::factory()->create([
        'brand' => 'Éxemplo  Áudio',
        'model' => 'EX-12',
        'variant' => '4 Ω',
    ]);

    expect($submission->dedupe_key)->toBe('exemplo audio ex-12 4 o');
});

it('recalcula a chave quando fabricante, modelo ou variante mudam', function () {
    $submission = DriverSubmission::factory()->create(['brand' => 'Alfa', 'model' => 'A1']);

    $submission->update(['model' => 'B2']);

    expect($submission->fresh()->dedupe_key)->toBe('alfa b2');
});

it('não expõe IP, e-mail nem chave de duplicata em JSON', function () {
    $submission = DriverSubmission::factory()->create(['contact_email' => 'pessoa@exemplo.com']);

    expect($submission->toArray())
        ->not->toHaveKey('ip_hash')
        ->not->toHaveKey('contact_email')
        ->not->toHaveKey('dedupe_key');
});

it('mantém as faixas e os parâmetros obrigatórios no model do driver', function () {
    expect(Driver::REQUIRED_PARAMETERS)->toBe(['fs_hz', 'qts', 'vas_m3'])
        ->and(Driver::RANGES)->toHaveKeys(['fs_hz', 'qts', 'vas_m3', 'nominal_diameter_m']);
});
