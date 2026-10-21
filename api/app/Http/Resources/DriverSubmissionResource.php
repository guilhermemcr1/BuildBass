<?php

namespace App\Http\Resources;

use App\Models\DriverSubmission;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Recibo do envio: só o protocolo e a situação. Nada do que foi enviado volta na resposta.
 *
 * @mixin DriverSubmission
 */
class DriverSubmissionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'protocol' => $this->id,
            'status' => $this->status->value,
        ];
    }
}
