<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Sugestão de preenchimento da leitura de manual: só os campos do driver em SI, os
 * suspeitos, os descartados e os avisos. Nunca o texto do manual nem a resposta bruta da IA.
 *
 * @property array{suggestion: array<string, mixed>, suspect: list<string>, discarded: list<string>, warnings: list<string>} $resource
 */
class ManualSuggestionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'suggestion' => $this->resource['suggestion'],
            'suspect' => $this->resource['suspect'],
            'discarded' => $this->resource['discarded'],
            'warnings' => $this->resource['warnings'],
        ];
    }
}
