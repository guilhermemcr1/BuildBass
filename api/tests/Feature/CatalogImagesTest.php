<?php

use App\Models\Driver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public', ['url' => 'https://api.test/storage']);
});

it('o resumo traz cover_thumb_url só quando há imagem', function () {
    $withImage = Driver::factory()->create([
        'brand' => 'Alfa', 'model' => 'Mod A',
        'images' => ['driver-images/11111111-1111-4111-8111-111111111111.webp', 'driver-images/22222222-2222-4222-8222-222222222222.webp'],
    ]);
    $without = Driver::factory()->create(['brand' => 'Beta', 'model' => 'Mod B']);

    $rows = collect($this->getJson('/api/drivers?q=mod')->assertOk()->json('data'))->keyBy('id');

    expect($rows[$withImage->id]['cover_thumb_url'])
        ->toBe('https://api.test/storage/driver-images/11111111-1111-4111-8111-111111111111_thumb.webp')
        ->and($rows[$without->id])->not->toHaveKey('cover_thumb_url')
        ->and($rows[$withImage->id])->not->toHaveKey('images');
});

it('o detalhe traz as imagens na ordem, a primeira é a capa, e lista vazia sem imagem', function () {
    $driver = Driver::factory()->create([
        'images' => ['driver-images/22222222-2222-4222-8222-222222222222.webp', 'driver-images/11111111-1111-4111-8111-111111111111.webp'],
    ]);
    $plain = Driver::factory()->create();

    $data = $this->getJson("/api/drivers/{$driver->id}")->assertOk()->json('data');

    expect($data['images'])->toBe([
        [
            'url' => 'https://api.test/storage/driver-images/22222222-2222-4222-8222-222222222222.webp',
            'thumb_url' => 'https://api.test/storage/driver-images/22222222-2222-4222-8222-222222222222_thumb.webp',
        ],
        [
            'url' => 'https://api.test/storage/driver-images/11111111-1111-4111-8111-111111111111.webp',
            'thumb_url' => 'https://api.test/storage/driver-images/11111111-1111-4111-8111-111111111111_thumb.webp',
        ],
    ])->and($data['cover_thumb_url'])->toBe($data['images'][0]['thumb_url']);

    $this->getJson("/api/drivers/{$plain->id}")->assertJsonPath('data.images', []);
});

it('não revela o nome original do arquivo nas URLs', function () {
    $driver = Driver::factory()->withImages(3)->create();

    $json = json_encode($this->getJson("/api/drivers/{$driver->id}")->json(), JSON_UNESCAPED_SLASHES);

    expect($json)->not->toContain('.jpg')->not->toContain('.png')
        ->and(preg_match_all('#/storage/driver-images/[0-9a-f-]{36}(_thumb)?\.webp#', $json))->toBe(7); // 3 x (url + thumb) e a capa
});

it('o envio público ignora qualquer campo de imagem', function () {
    $payload = [
        'brand' => 'Triton', 'model' => 'TR 620', 'source' => 'Ficha', 'fs_hz' => 76.94, 'qts' => 0.717,
        'vas_m3' => 0.026, 'contact_email' => 'a@b.co', 'locale' => 'pt-BR',
        'images' => ['driver-images/11111111-1111-4111-8111-111111111111.webp'],
    ];

    $this->postJson('/api/driver-submissions', $payload);

    expect(Schema::hasColumn('driver_submissions', 'images'))->toBeFalse();
});
