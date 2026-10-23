<?php

use App\Services\DriverImageStore;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    if (! function_exists('imagewebp')) {
        $this->markTestSkipped('GD sem suporte a WebP.');
    }

    Storage::fake('public', ['url' => 'https://api.test/storage']);
});

function pngBinary(): string
{
    $image = imagecreatetruecolor(300, 200);
    ob_start();
    imagepng($image);

    return (string) ob_get_clean();
}

it('grava a ampliada e a miniatura com nome uuid, sem o nome original', function () {
    $store = app(DriverImageStore::class);

    $path = $store->store(pngBinary());

    expect($path)->toMatch('#^driver-images/[0-9a-f-]{36}\.webp$#');
    Storage::disk('public')->assertExists($path);
    Storage::disk('public')->assertExists($store->thumbPath($path));
});

it('deriva a miniatura do nome da ampliada', function () {
    expect(app(DriverImageStore::class)->thumbPath('driver-images/abc.webp'))->toBe('driver-images/abc_thumb.webp');
});

it('apaga os dois arquivos', function () {
    $store = app(DriverImageStore::class);
    $path = $store->store(pngBinary());

    $store->delete($path);

    Storage::disk('public')->assertMissing($path);
    Storage::disk('public')->assertMissing($store->thumbPath($path));
});

it('não apaga caminho fora da pasta das imagens nem com ..', function () {
    Storage::disk('public')->put('outro/arquivo.webp', 'x');
    Storage::disk('public')->put('driver-images/x.txt', 'x');
    $store = app(DriverImageStore::class);

    $store->delete('outro/arquivo.webp');
    $store->delete('driver-images/../outro/arquivo.webp');
    $store->delete('driver-images/x.txt');

    Storage::disk('public')->assertExists('outro/arquivo.webp');
    Storage::disk('public')->assertExists('driver-images/x.txt');
    expect($store->validPath('driver-images/../x.webp'))->toBeFalse();
});

it('monta as URLs absolutas pelo disco público', function () {
    $store = app(DriverImageStore::class);
    $path = $store->store(pngBinary());

    expect($store->url($path))->toContain($path)->toStartWith('https://api.test/storage/')
        ->and($store->thumbUrl($path))->toContain('_thumb.webp');
});
