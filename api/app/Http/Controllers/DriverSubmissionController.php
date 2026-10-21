<?php

namespace App\Http\Controllers;

use App\Exceptions\DuplicateSubmissionException;
use App\Http\Requests\StoreDriverSubmissionRequest;
use App\Http\Resources\DriverSubmissionResource;
use App\Services\DriverSubmissionService;
use Illuminate\Http\JsonResponse;

class DriverSubmissionController extends Controller
{
    public function __construct(private readonly DriverSubmissionService $submissions) {}

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

        return (new DriverSubmissionResource($submission))
            ->response()
            ->setStatusCode(201);
    }
}
