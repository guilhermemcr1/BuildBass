<?php

namespace App\Services;

use App\Exceptions\DriverImageException;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Grava e apaga as imagens de driver no disco público. Cada imagem são dois arquivos:
 * `{uuid}.webp` (ampliada) e `{uuid}_thumb.webp` (miniatura); o banco guarda só o caminho da
 * ampliada. Os nomes são UUID: nunca revelam o nome original e nunca se reutilizam.
 */
class DriverImageStore
{
    public function __construct(private readonly DriverImageProcessor $processor) {}

    public function available(): bool
    {
        return function_exists('imagewebp');
    }

    /**
     * Converte e grava; devolve o caminho da ampliada, relativo ao disco.
     *
     * @throws DriverImageException
     */
    public function store(string $binary): string
    {
        $webp = $this->processor->process($binary);
        $path = $this->directory().'/'.Str::uuid()->toString().'.webp';

        $disk = $this->disk();
        $disk->put($path, $webp['full'], 'public');
        $disk->put($this->thumbPath($path), $webp['thumb'], 'public');

        return $path;
    }

    public function thumbPath(string $path): string
    {
        return (string) preg_replace('/\.webp$/', '_thumb.webp', $path);
    }

    /** Um caminho só vale se for de um arquivo gerado por esta classe (nada de `..` nem de outra pasta). */
    public function validPath(string $path): bool
    {
        return preg_match('#^'.preg_quote($this->directory(), '#').'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$#', $path) === 1;
    }

    public function delete(string $path): void
    {
        if (! $this->validPath($path)) {
            return;
        }

        $this->disk()->delete([$path, $this->thumbPath($path)]);
    }

    public function url(string $path): string
    {
        return $this->disk()->url($path);
    }

    public function thumbUrl(string $path): string
    {
        return $this->disk()->url($this->thumbPath($path));
    }

    private function directory(): string
    {
        return trim((string) config('driver_images.directory'), '/');
    }

    private function disk(): Filesystem
    {
        return Storage::disk((string) config('driver_images.disk'));
    }
}
