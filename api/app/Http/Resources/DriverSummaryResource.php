<?php

namespace App\Http\Resources;

use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resultado de busca: só o que a lista mostra.
 *
 * @mixin Driver
 */
class DriverSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'brand' => $this->brand,
            'model' => $this->model,
            'variant' => $this->variant === '' ? null : $this->variant,
            'fs_hz' => $this->fs_hz,
            'qts' => $this->qts,
            'vas_m3' => $this->vas_m3,
        ];
    }
}
