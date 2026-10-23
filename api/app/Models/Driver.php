<?php

namespace App\Models;

use App\Enums\DriverOrigin;
use App\Services\DriverImageStore;
use App\Support\SearchText;
use Database\Factories\DriverFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Driver do catálogo (somente leitura para o público). Valores em SI.
 *
 * @property string $id
 * @property string $brand
 * @property string $model
 * @property string $variant
 * @property string|null $type
 * @property string $source
 * @property DriverOrigin $origin
 * @property list<string>|null $images
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

    /** Formatos e tipos de pistão aceitos; os mesmos de web/src/lib/project/types.ts. */
    public const SHAPES = ['round', 'square', 'rect'];

    public const PISTONS = ['cone', 'dome', 'flat'];

    /**
     * Cotas físicas do alto-falante (opcionais, em metros): A aro externo, B diâmetro do cone,
     * C recorte, D segundo lado (quadrado e retangular), E profundidade do ímã, F espessura do aro,
     * G profundidade total. As chaves são as de web/src/lib/parameters.ts.
     */
    public const DIMENSION_RANGES = [
        'drv_a_m' => [0.03, 1.5],
        'drv_b_m' => [0.02, 1.5],
        'cutout_m' => [0.03, 1],
        'drv_d_m' => [0.03, 1.5],
        'drv_e_m' => [0.005, 1],
        'drv_f_m' => [0.001, 0.2],
        'drv_g_m' => [0.01, 1],
    ];

    /** Campos de medidas físicas do cadastro: formato, pistão e as cotas. */
    public const DIMENSION_FIELDS = ['drv_shape', 'drv_piston', ...self::DIMENSION_KEYS];

    /** Só as cotas (sem formato e pistão), na ordem A, B, C, D, E, F, G. */
    public const DIMENSION_KEYS = ['drv_a_m', 'drv_b_m', 'cutout_m', 'drv_d_m', 'drv_e_m', 'drv_f_m', 'drv_g_m'];

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
        ...self::DIMENSION_FIELDS,
        'source',
        'origin',
        'images',
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
            ...array_fill_keys(self::DIMENSION_KEYS, 'float'),
            'origin' => DriverOrigin::class,
            'images' => 'array',
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

        // Os arquivos de imagem acompanham o registro (feature 010, FR-033): saem os que deixaram
        // de estar na lista e todos quando o driver é excluído. Só depois do commit, para uma
        // transação desfeita não deixar o driver sem as imagens.
        static::saved(function (Driver $driver): void {
            if (! $driver->wasChanged('images')) {
                return;
            }

            $removed = array_diff((array) $driver->getOriginal('images'), (array) $driver->images);
            self::forgetImages($removed);
        });

        static::deleted(function (Driver $driver): void {
            self::forgetImages((array) $driver->images);
        });
    }

    /**
     * @param  array<int|string, mixed>  $paths
     */
    private static function forgetImages(array $paths): void
    {
        if ($paths === []) {
            return;
        }

        DB::afterCommit(function () use ($paths): void {
            $store = app(DriverImageStore::class);

            foreach ($paths as $path) {
                if (is_string($path)) {
                    $store->delete($path);
                }
            }
        });
    }
}
