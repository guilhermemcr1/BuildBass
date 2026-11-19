<?php

namespace App\Http\Controllers;

use App\Exceptions\BoxSuggestionException;
use App\Http\Requests\StoreBoxSuggestionRequest;
use App\Services\BoxSuggestion\BoxSuggestionService;
use Illuminate\Http\JsonResponse;

class BoxSuggestionController extends Controller
{
    public function __construct(private readonly BoxSuggestionService $suggestions) {}

    public function store(StoreBoxSuggestionRequest $request): JsonResponse
    {
        try {
            $candidates = $this->suggestions->suggest($request->forAi(), (string) $request->ip());
        } catch (BoxSuggestionException $exception) {
            return response()->json(
                ['message' => $exception->getMessage(), 'code' => $exception->reason],
                $exception->status,
                $exception->status === 429 ? ['Retry-After' => $exception->retryAfterS] : [],
            );
        }

        return response()->json(['data' => ['candidates' => $candidates]]);
    }
}
