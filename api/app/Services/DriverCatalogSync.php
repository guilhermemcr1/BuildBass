<?php

namespace App\Services;

use App\Enums\DriverOrigin;
use App\Exceptions\DriverImageException;
use App\Models\Driver;
use App\Support\DriverVariant;
use App\Support\SearchText;
use Database\Seeders\Support\DriverCatalogFiles;
use Illuminate\Support\Facades\DB;

/**
 * Sincroniza o banco com o catálogo inicial (database/seeders/data/drivers). Usado pelo DriverSeeder
 * e pelo comando `drivers:sync-catalog`, que também simula (`apply: false`) para ver o que mudaria.
 *
 * Só mexe em driver de carga inicial: o que um moderador cadastrou, aprovou ou corrigiu (outra
 * origem) nunca é tocado. Fotos só entram em driver sem imagem.
 */
class DriverCatalogSync
{
    /** Campos comparados para saber se um driver mudou (os do catálogo, sem a foto). */
    private const COMPARED = [
        'type', 'source', 'nominal_diameter_m', 'fs_hz', 'qts', 'qes', 'qms', 'vas_m3', 're_ohm',
        'le_h', 'xmax_m', 'sd_m2', 'pe_w', 'bl_tm', 'mms_kg', 'vd_m3',
    ];

    public function __construct(private readonly DriverImageStore $images) {}

    /**
     * @return array{
     *     created: list<string>, updated: array<string, list<string>>, renamed: array<string, string>,
     *     unchanged: int, protected: list<string>, stale: list<string>, removed: list<string>,
     *     images: list<string>, imageErrors: array<string, string>, imagesSkipped: int,
     *     nonStandard: array<string, string>
     * }
     */
    public function run(bool $apply, bool $prune = false): array
    {
        $report = [
            'created' => [], 'updated' => [], 'renamed' => [], 'unchanged' => 0, 'protected' => [],
            'stale' => [], 'removed' => [], 'images' => [], 'imageErrors' => [], 'imagesSkipped' => 0,
            'nonStandard' => [],
        ];
        $withImages = $this->images->available();
        $catalogKeys = [];

        foreach (DriverCatalogFiles::all() as $row) {
            $image = DriverCatalogFiles::imagePath($row['image']);
            unset($row['image']);

            $label = $this->label($row);
            $key = ['brand' => $row['brand'], 'model' => $row['model'], 'variant' => $row['variant']];
            $identity = SearchText::normalize("{$row['brand']} {$row['model']} {$row['variant']}");
            $catalogKeys[$identity] = true;

            $driver = Driver::where($key)->first();

            // Mesmo driver gravado com outra grafia (espaço, caixa, aspas): renomeia em vez de duplicar.
            if ($driver === null) {
                $driver = Driver::where('search_text', $identity)->first();

                if ($driver !== null && $driver->origin === DriverOrigin::InitialLoad) {
                    $report['renamed'][$this->label($driver->only(['brand', 'model', 'variant']))] = $label;
                }
            }

            if ($driver !== null && $driver->origin !== DriverOrigin::InitialLoad) {
                $report['protected'][] = $label;

                continue;
            }

            if ($driver === null) {
                $report['created'][] = $label;
            } else {
                $changed = $this->changedFields($driver, $row);

                if ($changed !== []) {
                    $report['updated'][$label] = $changed;
                } elseif (! isset($report['renamed'][$this->label($driver->only(['brand', 'model', 'variant']))])) {
                    $report['unchanged']++;
                }
            }

            // As fotos ficam fora do Git (data/drivers/images): num clone sem elas, o driver entra sem foto.
            $needsImage = $image !== null && is_file($image) && ($driver->images ?? []) === [];

            if ($needsImage) {
                $report['images'][] = $label;
            }

            if (! $apply) {
                continue;
            }

            $driver ??= new Driver;
            $driver->fill([...$row, 'origin' => DriverOrigin::InitialLoad])->save();

            if (! $needsImage) {
                continue;
            }

            if (! $withImages) {
                $report['imagesSkipped']++;

                continue;
            }

            try {
                $driver->update(['images' => [$this->images->store((string) file_get_contents((string) $image))]]);
            } catch (DriverImageException $exception) {
                $report['imageErrors'][$label] = $exception->getMessage();
            }
        }

        // Carga inicial que saiu do catálogo (renomeada acima já não conta).
        $stale = Driver::where('origin', DriverOrigin::InitialLoad)->get()
            ->reject(fn (Driver $driver): bool => isset($catalogKeys[$driver->search_text]));

        foreach ($stale as $driver) {
            $label = $this->label($driver->only(['brand', 'model', 'variant']));
            $report['stale'][] = $label;

            if ($apply && $prune) {
                DB::transaction(fn () => $driver->delete());
                $report['removed'][] = $label;
            }
        }

        $report['nonStandard'] = $this->nonStandard();

        return $report;
    }

    /**
     * Drivers de qualquer origem fora do padrão: variante que não é impedância ("4 Ω"/"4+4 Ω") e
     * identificações repetidas. Só relatório: quem corrige é um moderador, no painel.
     *
     * @return array<string, string>
     */
    private function nonStandard(): array
    {
        $found = [];

        foreach (Driver::all(['id', 'brand', 'model', 'variant', 'origin', 'search_text']) as $driver) {
            $label = $this->label($driver->only(['brand', 'model', 'variant']))." [{$driver->origin->value}]";

            $variant = $driver->variant;

            if ($variant !== '' && (DriverVariant::read($variant) === null || DriverVariant::format($variant) !== $variant)) {
                $found[$label] = 'variante fora do padrão (esperado "4 Ω" ou "4+4 Ω")';
            }
        }

        $repeated = Driver::query()->select('search_text')->groupBy('search_text')
            ->havingRaw('COUNT(*) > 1')->pluck('search_text');

        foreach ($repeated as $text) {
            $found["\"{$text}\""] = 'identificação repetida: '.Driver::where('search_text', $text)->count().' registros';
        }

        return $found;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return list<string>
     */
    private function changedFields(Driver $driver, array $row): array
    {
        $changed = [];

        foreach (self::COMPARED as $field) {
            $old = $driver->getAttribute($field);
            $new = $row[$field] ?? null;

            $same = is_numeric($old) && is_numeric($new)
                ? abs((float) $old - (float) $new) <= 1e-9 * max(1.0, abs((float) $new))
                : $old === $new;

            if (! $same) {
                $changed[] = $field;
            }
        }

        return $changed;
    }

    /** @param array<string, mixed> $row */
    private function label(array $row): string
    {
        return trim("{$row['brand']} {$row['model']} {$row['variant']}");
    }
}
