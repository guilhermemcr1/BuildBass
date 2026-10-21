<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDriverSubmissionRequest;
use App\Http\Resources\DriverSubmissionResource;
use App\Services\DriverSubmissionService;
use Illuminate\Http\JsonResponse;

class DriverSubmissionController extends Controller
{
    public function __construct(private readonly DriverSubmissionService $submissions) {}

    public function store(StoreDriverSubmissionRequest $request): JsonResponse
    {
        $submission = $this->submissions->create($request->submissionData(), (string) $request->ip());

        return (new DriverSubmissionResource($submission))
            ->response()
            ->setStatusCode(201);
    }
}
