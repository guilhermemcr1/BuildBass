<?php

namespace App\Http\Controllers;

use App\Enums\AuditType;
use App\Exceptions\DuplicateSubmissionException;
use App\Http\Requests\StoreDriverSubmissionRequest;
use App\Http\Resources\DriverSubmissionResource;
use App\Services\Audit\AuditLogger;
use App\Services\DriverSubmissionService;
use Illuminate\Http\JsonResponse;

class DriverSubmissionController extends Controller
{
    public function __construct(
        private readonly DriverSubmissionService $submissions,
        private readonly AuditLogger $audit,
    ) {}

    public function store(StoreDriverSubmissionRequest $request): JsonResponse
    {
        try {
            $submission = $this->submissions->create($request->submissionData(), (string) $request->ip());
        } catch (DuplicateSubmissionException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->reason,
            ], 409);
        }

        // Só o protocolo e o IP em hash: nada do remetente (e-mail de contato) vai para a trilha.
        $this->audit->recordDeferred(AuditType::SubmissionReceived, [
            'outcome' => 'ok',
            'subject_type' => 'submission',
            'subject_id' => $submission->id,
        ], $request->ip());

        return (new DriverSubmissionResource($submission))
            ->response()
            ->setStatusCode(201);
    }
}
