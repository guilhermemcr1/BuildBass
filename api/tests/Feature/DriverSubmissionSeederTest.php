<?php

use App\Enums\SubmissionStatus;
use App\Models\DriverSubmission;
use App\Services\DriverSubmissionService;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DriverSeeder;
use Database\Seeders\DriverSubmissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('cria envios fictícios pendentes, um deles duplicata do catálogo', function () {
    $this->seed(DriverSeeder::class);
    $this->seed(DriverSubmissionSeeder::class);

    expect(DriverSubmission::count())->toBe(3)
        ->and(DriverSubmission::where('status', '!=', SubmissionStatus::Pending->value)->count())->toBe(0);

    $alerts = DriverSubmission::all()->flatMap(fn ($submission) => app(DriverSubmissionService::class)->alertsFor($submission));

    expect($alerts)->toContain('Possível duplicata do catálogo')
        ->and($alerts->contains(fn (string $alert) => str_contains($alert, 'mesmo remetente')))->toBeTrue();
});

it('não entra no seeder padrão', function () {
    $this->seed(DatabaseSeeder::class);

    expect(DriverSubmission::count())->toBe(0);
});
