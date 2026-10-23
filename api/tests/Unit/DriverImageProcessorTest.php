<?php

use App\Exceptions\DriverImageException;
use App\Services\DriverImageProcessor;

beforeEach(function () {
    if (! function_exists('imagewebp')) {
        $this->markTestSkipped('GD sem suporte a WebP.');
    }
});

function sampleImage(string $format, int $width = 400, int $height = 300): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefill($image, 0, 0, imagecolorallocate($image, 200, 30, 30));

    ob_start();
    match ($format) {
        'jpeg' => imagejpeg($image, null, 90),
        'png' => imagepng($image),
        'webp' => imagewebp($image, null, 90),
        'gif' => imagegif($image),
    };

    return (string) ob_get_clean();
}

function webpSize(string $binary): array
{
    $info = getimagesizefromstring($binary);

    return [$info[0], $info[1], $info[2]];
}

it('converte JPEG, PNG e WebP em WebP, ampliada e miniatura', function (string $format) {
    $result = app(DriverImageProcessor::class)->process(sampleImage($format));

    expect(substr($result['full'], 0, 4))->toBe('RIFF')
        ->and(substr($result['full'], 8, 4))->toBe('WEBP')
        ->and(webpSize($result['full'])[2])->toBe(IMAGETYPE_WEBP)
        ->and(webpSize($result['thumb'])[2])->toBe(IMAGETYPE_WEBP);
})->with(['jpeg', 'png', 'webp']);

it('reduz a ampliada a 1280 px e a miniatura a 240 px no lado maior, mantendo a proporção', function () {
    $result = app(DriverImageProcessor::class)->process(sampleImage('jpeg', 2000, 1000));

    expect(webpSize($result['full']))->toBe([1280, 640, IMAGETYPE_WEBP])
        ->and(webpSize($result['thumb']))->toBe([240, 120, IMAGETYPE_WEBP]);
});

it('não amplia imagem pequena', function () {
    $result = app(DriverImageProcessor::class)->process(sampleImage('png', 100, 80));

    expect(webpSize($result['full']))->toBe([100, 80, IMAGETYPE_WEBP])
        ->and(webpSize($result['thumb']))->toBe([100, 80, IMAGETYPE_WEBP]);
});

it('preserva a transparência do PNG', function () {
    $image = imagecreatetruecolor(50, 50);
    imagealphablending($image, false);
    imagesavealpha($image, true);
    imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
    ob_start();
    imagepng($image);
    $png = (string) ob_get_clean();

    $result = app(DriverImageProcessor::class)->process($png);
    $decoded = imagecreatefromstring($result['full']);

    expect(imagecolorat($decoded, 10, 10) >> 24)->toBeGreaterThan(100);
});

it('recusa GIF, arquivo que não é imagem e PDF renomeado', function (string $binary) {
    expect(fn () => app(DriverImageProcessor::class)->process($binary))
        ->toThrow(DriverImageException::class);
})->with([
    'gif' => fn () => sampleImage('gif'),
    'texto' => fn () => 'isto não é uma imagem',
    'pdf' => fn () => "%PDF-1.4\n".str_repeat('0', 2048),
]);

it('recusa arquivo corrompido depois do cabeçalho', function () {
    $jpeg = sampleImage('jpeg');
    $corrupted = substr($jpeg, 0, 200).str_repeat("\x00", 50);

    expect(fn () => app(DriverImageProcessor::class)->process($corrupted))
        ->toThrow(DriverImageException::class);
});

it('recusa WebP animado', function () {
    // Cabeçalho VP8X com o bit de animação (0x02) ligado; basta para o recorte ser recusado.
    $animated = 'RIFF'.pack('V', 22).'WEBPVP8X'.pack('V', 10)."\x02\0\0\0".pack('V', 0x00000F | (0x00000F << 24)).'ANIM';

    expect(fn () => app(DriverImageProcessor::class)->process($animated))
        ->toThrow(DriverImageException::class);
});

it('recusa lado acima de 8000 px e acima de 24 megapixels antes de decodificar', function () {
    config(['driver_images.max_side_px' => 100]);
    expect(fn () => app(DriverImageProcessor::class)->process(sampleImage('png', 200, 20)))
        ->toThrow(DriverImageException::class, 'grande demais');

    config(['driver_images.max_side_px' => 8000, 'driver_images.max_megapixels' => 0.01]);
    expect(fn () => app(DriverImageProcessor::class)->process(sampleImage('png', 200, 100)))
        ->toThrow(DriverImageException::class, 'grande demais');
});

it('recusa arquivo acima do limite de tamanho', function () {
    config(['driver_images.max_kb' => 1]);

    expect(fn () => app(DriverImageProcessor::class)->process(str_repeat('a', 2048)))
        ->toThrow(DriverImageException::class, '5 MB');
});

it('não deixa metadado EXIF/GPS sobreviver', function () {
    $jpeg = sampleImage('jpeg');
    $exif = "Exif\0\0"."II*\0".pack('V', 8).pack('v', 1).pack('vvVV', 0x010F, 2, 8, 26)."\0\0\0\0".'SEGREDO-GPS'."\0";
    $withExif = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);
    expect($withExif)->toContain('SEGREDO-GPS');

    $result = app(DriverImageProcessor::class)->process($withExif);

    expect($result['full'])->not->toContain('SEGREDO-GPS')
        ->and($result['full'])->not->toContain('Exif');
});

it('aplica a orientação EXIF do JPEG', function () {
    if (! function_exists('exif_read_data')) {
        $this->markTestSkipped('Sem a extensão exif.');
    }

    $jpeg = sampleImage('jpeg', 400, 200);
    // Orientação 6 = girar 90° no sentido horário: a imagem 400x200 deve sair 200x400.
    $exif = "Exif\0\0"."II*\0".pack('V', 8).pack('v', 1).pack('vvVv', 0x0112, 3, 1, 6)."\0\0".pack('V', 0);
    $withExif = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);

    $result = app(DriverImageProcessor::class)->process($withExif);

    expect(webpSize($result['full']))->toBe([200, 400, IMAGETYPE_WEBP]);
});
