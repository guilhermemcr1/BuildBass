<?php

use App\Enums\AuditType;
use App\Filament\Resources\Drivers\Pages\CreateDriver;
use App\Filament\Resources\Drivers\Pages\EditDriver;
use App\Filament\Resources\Drivers\Pages\ListDrivers;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Services\DriverImageStore;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;

uses(RefreshDatabase::class);

beforeEach(function () {
    if (! function_exists('imagewebp')) {
        $this->markTestSkipped('GD sem suporte a WebP.');
    }

    Storage::fake('public', ['url' => 'https://api.test/storage']);
    signInModerator();
});

/** Cria os arquivos de um driver já com imagens gravadas no disco falso. */
function driverWithStoredImages(int $count): Driver
{
    $store = app(DriverImageStore::class);
    $png = (function () {
        ob_start();
        imagepng(imagecreatetruecolor(50, 50));

        return (string) ob_get_clean();
    })();
    $paths = array_map(fn () => $store->store($png), range(1, $count));

    return Driver::factory()->create(['images' => $paths]);
}

function filesOnDisk(): int
{
    return count(Storage::disk('public')->allFiles('driver-images'));
}

it('anexa JPEG, PNG e WebP, grava só WebP e a primeira vira a capa', function () {
    $driver = Driver::factory()->create();

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->fillForm(['images' => [
            UploadedFile::fake()->image('foto-original.jpg', 800, 600),
            UploadedFile::fake()->image('traseira.png', 400, 400),
            UploadedFile::fake()->image('curva.webp', 300, 200),
        ]])
        ->call('save')
        ->assertHasNoFormErrors();

    $images = $driver->fresh()->images;
    expect($images)->toHaveCount(3)
        ->and(filesOnDisk())->toBe(6);

    foreach ($images as $path) {
        expect($path)->toMatch('#^driver-images/[0-9a-f-]{36}\.webp$#')
            ->and($path)->not->toContain('foto-original');
        Storage::disk('public')->assertExists($path);
        Storage::disk('public')->assertExists(app(DriverImageStore::class)->thumbPath($path));
        expect(substr((string) Storage::disk('public')->get($path), 8, 4))->toBe('WEBP');
    }

    $this->getJson("/api/drivers/{$driver->id}")
        ->assertJsonPath('data.images.0.url', app(DriverImageStore::class)->url($images[0]));

    $event = AuditEvent::where('type', AuditType::DriverImagesChanged)->sole();
    expect($event->changes['images'][0])->toBe([])
        ->and($event->changes['images'][1])->toBe($images);
});

it('recusa a sexta imagem com a mensagem do limite', function () {
    $driver = Driver::factory()->create();

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->fillForm(['images' => array_map(
            fn (int $n) => UploadedFile::fake()->image("{$n}.jpg", 100, 100),
            range(1, 6),
        )])
        ->call('save')
        ->assertHasFormErrors(['images']);

    expect($driver->fresh()->images)->toBeNull()->and(filesOnDisk())->toBe(0);
});

it('recusa arquivo que não é imagem aceita ou passa de 5 MB, sem salvar nada', function (UploadedFile $file) {
    $driver = Driver::factory()->create();

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->fillForm(['images' => [$file]])
        ->call('save')
        ->assertHasFormErrors(['images']);

    expect($driver->fresh()->images)->toBeNull()->and(filesOnDisk())->toBe(0);
})->with([
    'pdf' => fn () => UploadedFile::fake()->create('ficha.pdf', 20, 'application/pdf'),
    'gif' => fn () => UploadedFile::fake()->image('anim.gif', 50, 50),
    'grande' => fn () => UploadedFile::fake()->image('enorme.jpg', 100, 100)->size(6000),
]);

it('reordena e a nova primeira vira a capa', function () {
    $driver = driverWithStoredImages(3);
    [$a, $b, $c] = $driver->images;

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->fillForm(['images' => [$c, $a, $b]])
        ->call('save')
        ->assertHasNoFormErrors();

    expect($driver->fresh()->images)->toBe([$c, $a, $b]);
    $this->getJson("/api/drivers/{$driver->id}")
        ->assertJsonPath('data.cover_thumb_url', app(DriverImageStore::class)->thumbUrl($c));
    expect(AuditEvent::where('type', AuditType::DriverImagesChanged)->count())->toBe(1);
});

it('escolher a imagem principal a leva para o começo e vira a capa', function () {
    $driver = driverWithStoredImages(3);
    [$a, $b, $c] = $driver->images;

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->assertFormSet(['cover' => '0'])
        ->fillForm(['cover' => '2'])
        ->assertFormSet(['cover' => '0'])
        ->call('save')
        ->assertHasNoFormErrors();

    expect($driver->fresh()->images)->toBe([$c, $a, $b]);
    $this->getJson("/api/drivers/{$driver->id}")
        ->assertJsonPath('data.cover_thumb_url', app(DriverImageStore::class)->thumbUrl($c));
});

it('esconde a escolha da principal com uma imagem só', function () {
    $driver = driverWithStoredImages(1);

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->assertFormFieldHidden('cover');
});

it('remover uma imagem apaga os dois arquivos', function () {
    $driver = driverWithStoredImages(2);
    [$keep, $drop] = $driver->images;

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->fillForm(['images' => [$keep]])
        ->call('save');

    expect($driver->fresh()->images)->toBe([$keep]);
    Storage::disk('public')->assertExists($keep);
    Storage::disk('public')->assertMissing($drop);
    Storage::disk('public')->assertMissing(app(DriverImageStore::class)->thumbPath($drop));
});

it('excluir o driver apaga todas as imagens, também em lote', function () {
    $one = driverWithStoredImages(2);
    $two = driverWithStoredImages(2);
    expect(filesOnDisk())->toBe(8);

    Livewire::test(ListDrivers::class)
        ->callAction(TestAction::make('delete')->table($one));
    expect(filesOnDisk())->toBe(4);

    Livewire::test(ListDrivers::class)
        ->selectTableRecords([$two->id])
        ->callAction(TestAction::make('delete')->table()->bulk());
    expect(filesOnDisk())->toBe(0);
});

it('mudar campos e imagens no mesmo salvamento grava driver_updated e driver_images_changed', function () {
    $driver = driverWithStoredImages(1);
    $path = $driver->images[0];

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->fillForm(['qts' => 0.77, 'images' => [$path, UploadedFile::fake()->image('b.jpg', 100, 100)]])
        ->call('save')
        ->assertHasNoFormErrors();

    expect(AuditEvent::where('type', AuditType::DriverUpdated)->count())->toBe(1)
        ->and(AuditEvent::where('type', AuditType::DriverImagesChanged)->count())->toBe(1);
});

it('cria o driver já com imagens', function () {
    Livewire::test(CreateDriver::class)
        ->fillForm([
            'brand' => 'Triton', 'model' => 'TR 620', 'source' => 'Ficha técnica',
            'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08,
            'images' => [UploadedFile::fake()->image('a.jpg', 100, 100)],
        ])
        ->call('create')
        ->assertHasNoFormErrors();

    expect(Driver::query()->sole()->images)->toHaveCount(1)->and(filesOnDisk())->toBe(2);
});

it('desfaz sem apagar arquivos quando a transação do salvamento é revertida', function () {
    $driver = driverWithStoredImages(2);
    [$keep, $drop] = $driver->images;

    try {
        DB::transaction(function () use ($driver, $keep) {
            $driver->update(['images' => [$keep]]);

            throw new RuntimeException('reverte');
        });
    } catch (RuntimeException) {
    }

    Storage::disk('public')->assertExists($drop);
});
