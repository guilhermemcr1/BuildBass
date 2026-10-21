<?php

namespace App\Services;

use App\Enums\SubmissionStatus;
use App\Models\DriverSubmission;
use App\Support\IpHash;

class DriverSubmissionService
{
    /**
     * Grava um envio pendente. Do remetente só ficam o hash do IP e o e-mail opcional.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, string $ip): DriverSubmission
    {
        $submission = new DriverSubmission($data);
        $submission->status = SubmissionStatus::Pending;
        $submission->ip_hash = IpHash::make($ip);
        $submission->save();

        return $submission;
    }
}
