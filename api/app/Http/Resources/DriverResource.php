<?php

namespace App\Http\Resources;

use App\Models\Driver;
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

        return [
            ...parent::toArray($request),
            ...$optional,
            'source' => $this->source,
        ];
    }
}
