<?php

namespace Database\Seeders\Support;

use RuntimeException;

/**
 * Lê os arquivos de database/seeders/data/drivers/*.json e converte as unidades da ficha técnica
 * (pol, L, mm, cm², mH, g, cm³) para SI, que é como o banco guarda. Cada arquivo é de uma marca:
 * `{"brand": "Bomber", "drivers": [{...}]}`. Os campos de cada driver estão no README.md da pasta
 * data/drivers.
 */
final class DriverCatalogFiles
{
    /** Campo no arquivo => [coluna no banco, divisor para chegar em SI]. */
    private const UNITS = [
        'diameter_in' => ['nominal_diameter_m', 1 / 0.0254],
        'vas_l' => ['vas_m3', 1000],
        'xmax_mm' => ['xmax_m', 1000],
        'sd_cm2' => ['sd_m2', 10000],
        'le_mh' => ['le_h', 1000],
        'mms_g' => ['mms_kg', 1000],
        'vd_cm3' => ['vd_m3', 1_000_000],
    ];

    /** Campos que já estão na unidade do banco. */
    private const PLAIN = ['fs_hz', 'qts', 'qes', 'qms', 're_ohm', 'pe_w', 'bl_tm'];

    public static function directory(): string
    {
        return __DIR__.'/../data/drivers';
    }

    /** Fotos do catálogo: `image` de cada driver é um caminho relativo a esta pasta. */
    public static function imagesDirectory(): string
    {
        return self::directory().'/images';
    }

    /** Caminho absoluto da foto de uma entrada, ou `null` sem foto. */
    public static function imagePath(?string $image): ?string
    {
        return $image === null || $image === '' ? null : self::imagesDirectory().'/'.ltrim($image, '/');
    }

    /**
     * @return list<string>
     */
    public static function files(): array
    {
        $files = glob(self::directory().'/*.json') ?: [];
        sort($files);

        return $files;
    }

    /**
     * Todos os drivers de todos os arquivos, já em SI e prontos para o `Driver`.
     *
     * @return list<array<string, mixed>>
     */
    public static function all(): array
    {
        $rows = [];

        foreach (self::files() as $file) {
            foreach (self::fromFile($file) as $row) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function fromFile(string $file): array
    {
        $data = json_decode((string) file_get_contents($file), true);

        if (! is_array($data) || ! is_string($data['brand'] ?? null) || ! is_array($data['drivers'] ?? null)) {
            throw new RuntimeException(basename($file).': esperado {"brand": "...", "drivers": [...]}');
        }

        return array_map(
            fn (array $entry): array => self::convert($data['brand'], $entry),
            array_values($data['drivers']),
        );
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    public static function convert(string $brand, array $entry): array
    {
        $row = [
            'brand' => $brand,
            'model' => $entry['model'] ?? null,
            'variant' => $entry['variant'] ?? '',
            'type' => $entry['type'] ?? null,
            'source' => $entry['source'] ?? null,
            'image' => $entry['image'] ?? null,
        ];

        foreach (self::PLAIN as $key) {
            $row[$key] = $entry[$key] ?? null;
        }

        foreach (self::UNITS as $key => [$column, $divisor]) {
            $row[$column] = isset($entry[$key]) ? round($entry[$key] / $divisor, 10) : null;
        }

        // Sem o Vd da ficha, ele é Sd × Xmax.
        $sd = $row['sd_m2'] ?? null;
        $xmax = $row['xmax_m'] ?? null;

        if (($row['vd_m3'] ?? null) === null && $sd !== null && $xmax !== null) {
            $row['vd_m3'] = round($sd * $xmax, 10);
        }

        return $row;
    }
}
