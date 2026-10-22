<?php

namespace App\Http\Resources;

use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resultado de busca: só o que a lista mostra (identificação, tipo, diâmetro e Fs, Qts, Vas).
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
            // Opcionais: sem valor no cadastro, a chave não vai no JSON.
            ...($this->type === null ? [] : ['type' => $this->type]),
            ...($this->nominal_diameter_m === null ? [] : ['nominal_diameter_m' => $this->nominal_diameter_m]),
            'fs_hz' => $this->fs_hz,
            'qts' => $this->qts,
            'vas_m3' => $this->vas_m3,
        ];
    }
}
