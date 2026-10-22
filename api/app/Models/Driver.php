<?php

namespace App\Models;

use App\Support\SearchText;
use Database\Factories\DriverFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Driver do catálogo (somente leitura para o público). Valores em SI.
 *
 * @property string $id
 * @property string $brand
 * @property string $model
 * @property string $variant
 * @property string|null $type
 * @property string $source
 * @property string $search_text
 */
class Driver extends Model
{
    /** @use HasFactory<DriverFactory> */
    use HasFactory;

    use HasUuids;

    /** Tipos de alto-falante aceitos (opcional no cadastro); os mesmos de web/src/lib/catalog/types.ts. */
    public const TYPES = ['subwoofer', 'woofer', 'midbass', 'midrange', 'fullrange'];

    /** Parâmetros Thiele-Small opcionais, na ordem em que a API os devolve. */
    public const OPTIONAL_PARAMETERS = [
        'nominal_diameter_m',
        'qes',
        'qms',
        're_ohm',
        'le_h',
        'xmax_m',
        'sd_m2',
        'pe_w',
        'bl_tm',
        'mms_kg',
        'vd_m3',
    ];

    /** Parâmetros que todo driver precisa ter (os demais podem faltar). */
    public const REQUIRED_PARAMETERS = ['fs_hz', 'qts', 'vas_m3'];

    /**
     * Faixas físicas aceitas por parâmetro: [mínimo, máximo], em SI. São as mesmas de
     * web/src/lib/parameters.ts (PARAMETERS) e de nominal_diameter_m em web/src/lib/catalog/schema.ts;
     * tests/Fixtures/submission-ranges.json trava a igualdade.
     */
    public const RANGES = [
        'nominal_diameter_m' => [0.03, 1.5],
        'fs_hz' => [1, 20000],
        'qts' => [0.05, 10],
        'qes' => [0.05, 10],
        'qms' => [0.1, 100],
        'vas_m3' => [1e-6, 10],
        're_ohm' => [0.1, 100],
        'le_h' => [0, 0.1],
        'xmax_m' => [0, 0.1],
        'sd_m2' => [1e-4, 2],
        'pe_w' => [0.1, 50000],
        'bl_tm' => [0.1, 100],
        'mms_kg' => [1e-4, 5],
        'vd_m3' => [0, 0.1],
    ];

    protected $fillable = [
        'brand',
        'model',
        'variant',
        'type',
        'nominal_diameter_m',
        'fs_hz',
        'qts',
        'vas_m3',
        'qes',
        'qms',
        're_ohm',
        'le_h',
        'xmax_m',
        'sd_m2',
        'pe_w',
        'bl_tm',
        'mms_kg',
        'vd_m3',
        'source',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'nominal_diameter_m' => 'float',
            'fs_hz' => 'float',
            'qts' => 'float',
            'vas_m3' => 'float',
            'qes' => 'float',
            'qms' => 'float',
            're_ohm' => 'float',
            'le_h' => 'float',
            'xmax_m' => 'float',
            'sd_m2' => 'float',
            'pe_w' => 'float',
            'bl_tm' => 'float',
            'mms_kg' => 'float',
            'vd_m3' => 'float',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Driver $driver): void {
            $driver->variant ??= '';
            $driver->search_text = SearchText::normalize(
                "{$driver->brand} {$driver->model} {$driver->variant}",
            );
        });
    }
}
