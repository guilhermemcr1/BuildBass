<?php

use App\Enums\DriverOrigin;
use App\Models\Driver;
use App\Models\DriverSubmission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

function originMigration(): Migration
{
    /** @var Migration $migration */
    $migration = require database_path('migrations/2026_10_22_130100_add_origin_and_images_to_drivers.php');

    return $migration;
}

it('cria os drivers novos como carga inicial e sem imagens', function () {
    $driver = Driver::factory()->create()->refresh();

    expect($driver->origin)->toBe(DriverOrigin::InitialLoad)
        ->and($driver->images)->toBeNull();
});

it('na migration, marca como envio aprovado o driver ligado a um envio e deixa o resto como carga inicial', function () {
    $fromSubmission = Driver::factory()->create();
    $loaded = Driver::factory()->create();
    DriverSubmission::factory()->approved()->create(['driver_id' => $fromSubmission->id]);

    $migration = originMigration();
    $migration->down();
    expect(Schema::hasColumn('drivers', 'origin'))->toBeFalse()
        ->and(Schema::hasColumn('drivers', 'images'))->toBeFalse();

    $migration->up();

    expect(Driver::find($fromSubmission->id)->origin)->toBe(DriverOrigin::ApprovedSubmission)
        ->and(Driver::find($loaded->id)->origin)->toBe(DriverOrigin::InitialLoad)
        ->and(Driver::find($loaded->id)->images)->toBeNull();
});
