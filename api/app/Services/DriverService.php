<?php

namespace App\Services;

use App\Enums\AuditType;
use App\Enums\DriverOrigin;
use App\Exceptions\DuplicateDriverException;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\Audit\AuditDiff;
use App\Services\Audit\AuditLogger;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Cadastro de drivers pelo painel (feature 010). Cada operação roda numa transação que inclui o
 * evento de auditoria: se o evento falhar, a mudança é desfeita (FR-016). Valida pelas mesmas
 * faixas físicas do envio público (`Driver::RANGES`) e recusa duplicata.
 */
class DriverService
{
    /** Tudo o que o cadastro grava: os campos do envio público mais as medidas físicas. */
    public const FIELDS = [...DriverSubmission::DRIVER_FIELDS, ...Driver::DIMENSION_FIELDS];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly DriverCatalogService $catalog,
        private readonly DriverImageStore $images,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     *
     * @throws DuplicateDriverException
     * @throws ValidationException
     */
    public function create(array $data, Moderator $actor): Driver
    {
        $fields = Arr::only($data, self::FIELDS);
        $fields['variant'] = (string) ($fields['variant'] ?? '');
        $fields = $this->cleanDimensions($fields);

        $this->validate($fields);
        $images = $this->cleanImages($data['images'] ?? []);

        try {
            return DB::transaction(function () use ($fields, $images, $actor): Driver {
                $this->assertNotDuplicate($fields);

                $driver = Driver::create([
                    ...$fields,
                    'origin' => DriverOrigin::Direct,
                    'images' => $images === [] ? null : $images,
                ]);

                $this->audit->record(AuditType::DriverCreated, [
                    'subject_type' => 'driver',
                    'subject_id' => $driver->id,
                    'subject_label' => $this->audit->driverLabel($driver),
                    'snapshot' => self::snapshot($driver),
                ], $actor);

                return $driver;
            });
        } catch (UniqueConstraintViolationException) {
            throw new DuplicateDriverException;
        }
    }

    /**
     * @param  array<string, mixed>  $data
     *
     * @throws DuplicateDriverException
     * @throws ValidationException
     */
    public function update(Driver $driver, array $data, Moderator $actor): Driver
    {
        try {
            return DB::transaction(function () use ($driver, $data, $actor): Driver {
                $locked = Driver::query()->lockForUpdate()->findOrFail($driver->id);
                $before = $locked->only(self::FIELDS);

                $fields = [...$before, ...Arr::only($data, self::FIELDS)];
                $fields['variant'] = (string) ($fields['variant'] ?? '');
                $fields = $this->cleanDimensions($fields);

                $this->validate($fields);
                $this->assertNotDuplicate($fields, $locked->id);

                $imagesBefore = (array) $locked->images;
                $imagesAfter = array_key_exists('images', $data) ? $this->cleanImages($data['images']) : $imagesBefore;

                $locked->fill($fields);
                $locked->images = $imagesAfter === [] ? null : $imagesAfter;
                $locked->save();

                $changes = AuditDiff::between($before, $locked->only(self::FIELDS), self::FIELDS);

                if ($changes !== []) {
                    $this->audit->record(AuditType::DriverUpdated, [
                        'subject_type' => 'driver',
                        'subject_id' => $locked->id,
                        'subject_label' => $this->audit->driverLabel($locked),
                        'changes' => $changes,
                    ], $actor);
                }

                if ($imagesBefore !== $imagesAfter) {
                    $this->audit->record(AuditType::DriverImagesChanged, [
                        'subject_type' => 'driver',
                        'subject_id' => $locked->id,
                        'subject_label' => $this->audit->driverLabel($locked),
                        'changes' => ['images' => [$imagesBefore, $imagesAfter]],
                    ], $actor);
                }

                return $locked;
            });
        } catch (UniqueConstraintViolationException) {
            throw new DuplicateDriverException;
        }
    }

    public function delete(Driver $driver, Moderator $actor): void
    {
        DB::transaction(function () use ($driver, $actor): void {
            $locked = Driver::query()->lockForUpdate()->findOrFail($driver->id);
            $snapshot = self::snapshot($locked);
            $label = $this->audit->driverLabel($locked);

            $locked->delete();

            $this->audit->record(AuditType::DriverDeleted, [
                'subject_type' => 'driver',
                'subject_id' => $driver->id,
                'subject_label' => $label,
                'snapshot' => $snapshot,
            ], $actor);
        });
    }

    /**
     * Conteúdo do driver para a trilha: os campos do cadastro, a origem e as imagens.
     *
     * @return array<string, mixed>
     */
    public static function snapshot(Driver $driver): array
    {
        return [
            ...$driver->only(self::FIELDS),
            'origin' => ($driver->origin ?? DriverOrigin::InitialLoad)->value,
            'images' => $driver->images ?? [],
        ];
    }

    /**
     * @param  array<string, mixed>  $fields
     */
    private function assertNotDuplicate(array $fields, ?string $ignoreId = null): void
    {
        $existing = $this->catalog->findDuplicate(
            (string) $fields['brand'],
            (string) $fields['model'],
            (string) $fields['variant'],
            $ignoreId,
        );

        if ($existing !== null) {
            throw new DuplicateDriverException($this->audit->driverLabel($existing));
        }
    }

    /**
     * Só o formato retangular tem segundo lado: nos demais a cota D é descartada (o formulário a
     * esconde, mas o valor antigo poderia ficar no registro). Campo vazio vira `null`.
     *
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    private function cleanDimensions(array $fields): array
    {
        foreach (Driver::DIMENSION_FIELDS as $key) {
            if (($fields[$key] ?? null) === '') {
                $fields[$key] = null;
            }
        }

        if (($fields['drv_shape'] ?? null) !== 'rect') {
            $fields['drv_d_m'] = null;
        }

        return $fields;
    }

    /**
     * Lista de imagens do formulário: só caminhos gerados por `DriverImageStore`, sem repetir, até o
     * limite por driver. A ordem é a da galeria (o primeiro é a capa).
     *
     * @return list<string>
     */
    private function cleanImages(mixed $images): array
    {
        $paths = array_values(array_unique(array_filter((array) $images, 'is_string')));

        foreach ($paths as $path) {
            if (! $this->images->validPath($path)) {
                throw ValidationException::withMessages(['images' => (string) __('driver_images.invalid_path')]);
            }
        }

        if (count($paths) > (int) config('driver_images.max_files')) {
            throw ValidationException::withMessages(['images' => (string) __('driver_images.too_many')]);
        }

        return $paths;
    }

    /**
     * Rede de segurança: o formulário já valida, mas o service não confia em quem o chama.
     *
     * @param  array<string, mixed>  $fields
     */
    private function validate(array $fields): void
    {
        $rules = [
            'brand' => ['required', 'string', 'max:80'],
            'model' => ['required', 'string', 'max:80'],
            'variant' => ['nullable', 'string', 'max:40'],
            'type' => ['nullable', 'string', 'in:'.implode(',', Driver::TYPES)],
            'source' => ['required', 'string', 'max:255'],
        ];

        foreach (Driver::RANGES as $key => [$min, $max]) {
            $required = in_array($key, Driver::REQUIRED_PARAMETERS, true) ? 'required' : 'nullable';
            $rules[$key] = [$required, 'numeric', "min:{$min}", "max:{$max}"];
        }

        $rules['drv_shape'] = ['nullable', 'string', 'in:'.implode(',', Driver::SHAPES)];
        $rules['drv_piston'] = ['nullable', 'string', 'in:'.implode(',', Driver::PISTONS)];

        foreach (Driver::DIMENSION_RANGES as $key => [$min, $max]) {
            $rules[$key] = ['nullable', 'numeric', "min:{$min}", "max:{$max}"];
        }

        Validator::make($fields, $rules)->validate();
    }
}
