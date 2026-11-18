<?php

use App\Enums\DriverOrigin;
use App\Models\Driver;
use App\Services\DriverImageStore;
use App\Support\DriverVariant;
use Database\Seeders\DriverSeeder;
use Database\Seeders\Support\DriverCatalogFiles;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** Chaves aceitas em cada driver dos JSON (unidades da ficha). */
const CATALOG_FIELDS = [
    'model', 'variant', 'type', 'source', 'source_url', 'image', 'image_source', 'image_origin', 'diameter_in',
    'fs_hz', 'qts', 'qes', 'qms', 'vas_l', 're_ohm', 'le_mh', 'xmax_mm', 'sd_cm2', 'pe_w', 'bl_tm', 'mms_g', 'vd_cm3',
];

/** @return list<array{string, array<string, mixed>}> [arquivo, entrada bruta] */
function catalogEntries(): array
{
    $entries = [];

    foreach (DriverCatalogFiles::files() as $file) {
        $data = json_decode((string) file_get_contents($file), true);

        foreach ($data['drivers'] as $entry) {
            $entries[] = [basename($file), $data['brand'], $entry];
        }
    }

    return $entries;
}

function catalogLabel(string $file, array $entry): string
{
    return "{$file}: ".($entry['model'] ?? '?').' '.($entry['variant'] ?? '');
}

it('tem pelo menos um arquivo de marca e cada um é válido', function () {
    expect(DriverCatalogFiles::files())->not->toBeEmpty();

    foreach (DriverCatalogFiles::files() as $file) {
        $data = json_decode((string) file_get_contents($file), true);

        expect($data)->toBeArray(basename($file).' não é JSON válido')
            ->and($data['brand'] ?? null)->toBeString()
            ->and($data['drivers'] ?? null)->toBeArray();
    }
});

it('usa só campos conhecidos, com os obrigatórios e os tipos certos', function () {
    foreach (catalogEntries() as [$file, , $entry]) {
        $label = catalogLabel($file, $entry);

        expect(array_diff(array_keys($entry), CATALOG_FIELDS))->toBe([], "{$label}: campo desconhecido");

        foreach (['model', 'source', 'fs_hz', 'qts', 'vas_l'] as $required) {
            expect($entry[$required] ?? null)->not->toBeNull("{$label}: falta {$required}");
        }

        expect(mb_strlen($entry['model']))->toBeLessThanOrEqual(80, "{$label}: model > 80")
            ->and(mb_strlen($entry['variant'] ?? ''))->toBeLessThanOrEqual(40, "{$label}: variant > 40")
            ->and(mb_strlen($entry['source']))->toBeLessThanOrEqual(255, "{$label}: source > 255");

        if (isset($entry['type'])) {
            expect(in_array($entry['type'], Driver::TYPES, true))->toBeTrue("{$label}: type inválido");
        }

        foreach (array_diff(array_keys($entry), ['model', 'variant', 'type', 'source', 'source_url', 'image', 'image_source', 'image_origin']) as $numeric) {
            expect($entry[$numeric])->toBeNumeric("{$label}: {$numeric} não é número");
        }
    }
});

it('cada foto existe, é imagem que o painel aceita e diz de onde veio', function () {
    // As fotos não vão para o Git: num clone sem a pasta, só os campos de origem são conferidos.
    $hasImages = is_dir(DriverCatalogFiles::imagesDirectory());
    $failures = [];

    foreach (catalogEntries() as [$file, , $entry]) {
        $label = catalogLabel($file, $entry);
        $image = $entry['image'] ?? null;

        if ($image === null) {
            if (isset($entry['image_source']) || isset($entry['image_origin'])) {
                $failures[] = "{$label}: image_source/image_origin sem image";
            }

            continue;
        }

        if (! is_string($entry['image_source'] ?? null) || ! str_starts_with($entry['image_source'], 'https://')) {
            $failures[] = "{$label}: falta image_source (URL https da página de onde a foto veio)";
        }

        if (! in_array($entry['image_origin'] ?? null, ['fabricante', 'loja'], true)) {
            $failures[] = "{$label}: image_origin deve ser fabricante ou loja";
        }

        if (str_contains($image, '..')) {
            $failures[] = "{$label}: caminho de foto inválido";

            continue;
        }

        if (! $hasImages) {
            continue;
        }

        $path = DriverCatalogFiles::imagePath($image);

        if (! is_file((string) $path)) {
            $failures[] = "{$label}: foto {$image} não existe em data/drivers/images";

            continue;
        }

        $info = @getimagesize((string) $path);

        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            $failures[] = "{$label}: {$image} não é JPEG, PNG nem WebP";
        } elseif (filesize((string) $path) > config('driver_images.max_kb') * 1024
            || max($info[0], $info[1]) > config('driver_images.max_side_px')
            || min($info[0], $info[1]) < 200) {
            $failures[] = "{$label}: {$image} fora dos limites ({$info[0]}×{$info[1]})";
        }

    }

    expect($failures)->toBe([]);
});

it('não repete marca + modelo + variação', function () {
    $seen = [];

    foreach (catalogEntries() as [$file, $brand, $entry]) {
        $key = mb_strtolower("{$brand}|{$entry['model']}|".($entry['variant'] ?? ''));

        expect($seen)->not->toHaveKey($key, catalogLabel($file, $entry).' duplicado');
        $seen[$key] = true;
    }
});

it('todo parâmetro em SI cabe nas faixas físicas do app', function () {
    $failures = [];

    foreach (DriverCatalogFiles::all() as $row) {
        foreach (Driver::RANGES as $key => [$min, $max]) {
            $value = $row[$key] ?? null;

            if ($value !== null && ($value < $min || $value > $max)) {
                $failures[] = "{$row['brand']} {$row['model']} {$row['variant']}: {$key}={$value} fora de [{$min}, {$max}]";
            }
        }
    }

    expect($failures)->toBe([]);
});

// Erro de digitação ou de unidade quase sempre quebra uma destas relações. As tolerâncias são
// folgadas porque a ficha arredonda e cada fabricante mede de um jeito; não pegam diferença pequena.
// Lista todas as falhas de uma vez, em vez de parar na primeira.
it('os parâmetros fecham entre si', function () {
    $failures = [];

    foreach (DriverCatalogFiles::all() as $row) {
        $label = "{$row['brand']} {$row['model']} {$row['variant']}";

        // 1/Qts = 1/Qes + 1/Qms
        if ($row['qes'] !== null && $row['qms'] !== null) {
            $qts = 1 / (1 / $row['qes'] + 1 / $row['qms']);

            if (abs($qts - $row['qts']) / $row['qts'] >= 0.08) {
                $failures[] = "{$label}: Qts {$row['qts']} ≠ Qes∥Qms {$qts}";
            }
        }

        // Qes = 2π · Fs · Mms · Re / BL²
        if ($row['qes'] !== null && $row['mms_kg'] !== null && $row['re_ohm'] !== null && $row['bl_tm'] !== null) {
            $qes = 2 * M_PI * $row['fs_hz'] * $row['mms_kg'] * $row['re_ohm'] / ($row['bl_tm'] ** 2);

            if (abs($qes - $row['qes']) / $row['qes'] >= 0.25) {
                $failures[] = "{$label}: Qes {$row['qes']} ≠ calculado {$qes} (Fs·Mms·Re/BL²)";
            }
        }

        // Sd e diâmetro nominal: o cone útil é uma fração do diâmetro nominal.
        if ($row['sd_m2'] !== null && $row['nominal_diameter_m'] !== null) {
            $ratio = sqrt($row['sd_m2'] * 4 / M_PI) / $row['nominal_diameter_m'];

            if ($ratio < 0.55 || $ratio > 1.0) {
                $failures[] = "{$label}: Sd {$row['sd_m2']} m² não combina com {$row['nominal_diameter_m']} m";
            }
        }

        if ($row['pe_w'] !== null && $row['pe_w'] < 5) {
            $failures[] = "{$label}: Pe {$row['pe_w']} W muito baixo, é RMS?";
        }
    }

    expect($failures)->toBe([]);
});

it('a variante é impedância válida, e a bobina dupla vem medida em série', function () {
    $failures = [];

    foreach (catalogEntries() as [$file, , $entry]) {
        $label = catalogLabel($file, $entry);
        $variant = $entry['variant'] ?? '';

        if ($variant === '') {
            continue;
        }

        $read = DriverVariant::read($variant);

        if ($read === null || DriverVariant::format($variant) !== $variant) {
            $failures[] = "{$label}: variante fora do padrão (\"4 Ω\" ou \"4+4 Ω\")";

            continue;
        }

        [$ohms, $coils] = $read;

        // A ficha de bobina dupla mede as duas em série: Re perto de 2× a impedância de uma bobina.
        // Re de uma bobina só (ou medida em paralelo) faria o simulador errar a carga.
        if ($coils === 2 && isset($entry['re_ohm'])) {
            $ratio = $entry['re_ohm'] / (2 * $ohms);

            if ($ratio < 0.6 || $ratio > 1.0) {
                $failures[] = "{$label}: Re {$entry['re_ohm']} não é de bobinas em série (razão {$ratio})";
            }
        }
    }

    expect($failures)->toBe([]);
});

it('o seeder grava o catálogo todo, em SI, e é idempotente', function () {
    $this->seed(DriverSeeder::class);
    $this->seed(DriverSeeder::class);

    expect(Driver::count())->toBe(count(DriverCatalogFiles::all()));

    $tr620 = Driver::where('model', 'TR 620 12"')->firstOrFail();

    expect($tr620->brand)->toBe('Triton')
        ->and($tr620->origin)->toBe(DriverOrigin::InitialLoad)
        ->and($tr620->nominal_diameter_m)->toBe(0.3048)
        ->and($tr620->sd_m2)->toBe(0.05309)
        ->and($tr620->vas_m3)->toBe(0.026348)
        ->and($tr620->xmax_m)->toBe(0.00635)
        ->and($tr620->mms_kg)->toBe(0.06392)
        ->and($tr620->le_h)->toBe(0.000607)
        ->and($tr620->vd_m3)->toBe(0.000333)
        ->and($tr620->search_text)->toContain('triton')
        ->and($tr620->search_text)->toContain('tr 620');
});

it('não sobrescreve driver que o painel já corrigiu ou cadastrou', function () {
    $this->seed(DriverSeeder::class);

    $driver = Driver::where('model', 'TR 620 12"')->firstOrFail();
    $driver->update(['fs_hz' => 50, 'origin' => DriverOrigin::Direct]);

    $this->seed(DriverSeeder::class);

    expect($driver->fresh()->fs_hz)->toBe(50.0);
});

it('importa a foto do catálogo só em driver sem imagem, e pula sem WebP', function () {
    $entry = collect(DriverCatalogFiles::all())
        ->first(fn (array $row): bool => is_file((string) DriverCatalogFiles::imagePath($row['image'])));

    if ($entry === null) {
        $this->markTestSkipped('sem as fotos do catálogo (data/drivers/images fica fora do Git)');
    }

    $store = Mockery::mock(DriverImageStore::class);
    $store->shouldReceive('available')->andReturn(true);
    $store->shouldReceive('delete');
    $store->shouldReceive('store')->andReturn('driver-images/00000000-0000-0000-0000-000000000001.webp');
    $this->app->instance(DriverImageStore::class, $store);

    $this->seed(DriverSeeder::class);
    $driver = Driver::where(['brand' => $entry['brand'], 'model' => $entry['model'], 'variant' => $entry['variant']])->firstOrFail();

    expect($driver->images)->toBe(['driver-images/00000000-0000-0000-0000-000000000001.webp']);

    // A galeria de um moderador nunca é trocada no seed seguinte.
    $driver->update(['images' => ['driver-images/00000000-0000-0000-0000-000000000002.webp']]);
    $this->seed(DriverSeeder::class);

    expect($driver->fresh()->images)->toBe(['driver-images/00000000-0000-0000-0000-000000000002.webp']);
});
