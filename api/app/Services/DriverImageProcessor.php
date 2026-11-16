<?php

namespace App\Services;

use App\Exceptions\DriverImageException;
use GdImage;

/**
 * Transforma o arquivo enviado em duas imagens WebP (ampliada e miniatura), sem biblioteca extra.
 * O arquivo é entrada não confiável: o tipo vem do conteúdo, as
 * dimensões são checadas antes de decodificar (protege a memória) e o reencode descarta todo
 * metadado (EXIF, GPS). A orientação do JPEG é aplicada antes.
 */
class DriverImageProcessor
{
    private const ALLOWED_TYPES = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP];

    /**
     * @return array{full: string, thumb: string} binários WebP
     *
     * @throws DriverImageException
     */
    public function process(string $binary): array
    {
        if (! function_exists('imagewebp')) {
            throw new DriverImageException('unavailable');
        }

        if (strlen($binary) > (int) config('driver_images.max_kb') * 1024) {
            throw new DriverImageException('too_large');
        }

        $info = @getimagesizefromstring($binary);

        if ($info === false || ! in_array($info[2], self::ALLOWED_TYPES, true)) {
            throw new DriverImageException('formats');
        }

        [$width, $height] = $info;

        if ($width > (int) config('driver_images.max_side_px')
            || $height > (int) config('driver_images.max_side_px')
            || $width * $height > (float) config('driver_images.max_megapixels') * 1_000_000) {
            throw new DriverImageException('dimensions');
        }

        if ($info[2] === IMAGETYPE_WEBP && $this->animatedWebp($binary)) {
            throw new DriverImageException('animated');
        }

        $image = @imagecreatefromstring($binary);

        if (! $image instanceof GdImage) {
            throw new DriverImageException('unreadable');
        }

        if ($info[2] === IMAGETYPE_JPEG) {
            $image = $this->oriented($image, $binary);
        }

        return [
            'full' => $this->encode($image, (int) config('driver_images.full_px'), (int) config('driver_images.full_quality')),
            'thumb' => $this->encode($image, (int) config('driver_images.thumb_px'), (int) config('driver_images.thumb_quality')),
        ];
    }

    /** Cabeçalho VP8X com o bit de animação ligado (RIFF....WEBPVP8X + flags). */
    private function animatedWebp(string $binary): bool
    {
        return substr($binary, 12, 4) === 'VP8X' && (ord($binary[20] ?? "\0") & 0x02) !== 0;
    }

    private function oriented(GdImage $image, string $binary): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data('data://image/jpeg;base64,'.base64_encode($binary));
        $orientation = is_array($exif) ? ($exif['Orientation'] ?? 1) : 1;

        $degrees = match ($orientation) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        if ($degrees === 0) {
            return $image;
        }

        $rotated = imagerotate($image, $degrees, 0);

        return $rotated instanceof GdImage ? $rotated : $image;
    }

    private function encode(GdImage $image, int $maxSide, int $quality): string
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $longest = max($width, $height);

        $target = $image;

        if ($longest > $maxSide) {
            $scale = $maxSide / $longest;
            $scaled = imagescale(
                $image,
                max(1, (int) round($width * $scale)),
                max(1, (int) round($height * $scale)),
                IMG_BILINEAR_FIXED,
            );

            if (! $scaled instanceof GdImage) {
                throw new DriverImageException('unreadable');
            }

            $target = $scaled;
        }

        if (! imageistruecolor($target)) {
            imagepalettetotruecolor($target);
        }

        imagealphablending($target, false);
        imagesavealpha($target, true);

        ob_start();
        $written = imagewebp($target, null, $quality);
        $webp = (string) ob_get_clean();

        if (! $written || $webp === '') {
            throw new DriverImageException('unreadable');
        }

        return $webp;
    }
}
