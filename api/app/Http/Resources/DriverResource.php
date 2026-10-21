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

        foreach (Driver::OPTIONAL_PARAMETERS as $key) {
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
