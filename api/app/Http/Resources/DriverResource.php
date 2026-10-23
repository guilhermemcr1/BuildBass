<?php

namespace App\Http\Resources;

use App\Models\Driver;
use App\Services\DriverImageStore;
use Illuminate\Http\Request;

/**
 * Driver completo. Parâmetros sem valor no cadastro não aparecem no JSON.
 *
 * @mixin Driver
 */
class DriverResource extends DriverSummaryResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $optional = [];

        // O diâmetro nominal já vai no resumo (null quando falta); aqui só o que ainda não foi.
        foreach (array_diff(Driver::OPTIONAL_PARAMETERS, ['nominal_diameter_m']) as $key) {
            if ($this->{$key} !== null) {
                $optional[$key] = $this->{$key};
            }
        }

        // Medidas físicas: só as preenchidas (formato e pistão como texto, cotas em metros).
        $dimensions = [];
        foreach (Driver::DIMENSION_FIELDS as $key) {
            if ($this->{$key} !== null) {
                $dimensions[$key] = $this->{$key};
            }
        }

        $store = app(DriverImageStore::class);

        return [
            ...parent::toArray($request),
            ...$optional,
            ...$dimensions,
            'source' => $this->source,
            // Galeria na ordem definida; o primeiro item é a capa. Sem imagem, lista vazia.
            'images' => array_map(
                fn (string $path): array => ['url' => $store->url($path), 'thumb_url' => $store->thumbUrl($path)],
                (array) $this->images,
            ),
        ];
    }
}
