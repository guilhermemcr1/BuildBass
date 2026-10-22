<?php

namespace App\Http\Controllers;

use App\Exceptions\Manual\ManualException;
use App\Exceptions\Manual\ManualInvalidFileException;
use App\Exceptions\Manual\ManualRateLimitedException;
use App\Http\Requests\ExtractManualRequest;
use App\Http\Resources\ManualSuggestionResource;
use App\Services\Manual\ManualExtractionService;
use Illuminate\Http\JsonResponse;

class ManualExtractionController extends Controller
{
    public function __construct(private readonly ManualExtractionService $extraction) {}

    public function store(ExtractManualRequest $request): JsonResponse
    {
        try {
            $result = $this->extraction->extract($request->manualFile(), (string) $request->ip());
        } catch (ManualRateLimitedException $exception) {
            return response()->json(
                ['message' => $exception->getMessage(), 'code' => $exception->reason],
                $exception->status,
                ['Retry-After' => $exception->retryAfterS],
            );
        } catch (ManualInvalidFileException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'invalid_file',
                'errors' => ['manual' => [$exception->reason]],
            ], $exception->status);
        } catch (ManualException $exception) {
            return response()->json(
                ['message' => $exception->getMessage(), 'code' => $exception->reason],
                $exception->status,
            );
        }

        return (new ManualSuggestionResource($result))->response();
    }
}
