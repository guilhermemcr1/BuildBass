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
 * @property string $source
 * @property string $search_text
 */
class Driver extends Model
{
    /** @use HasFactory<DriverFactory> */
    use HasFactory;

    use HasUuids;

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

    protected $fillable = [
        'brand',
        'model',
        'variant',
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
