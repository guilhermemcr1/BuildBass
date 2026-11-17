<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchDriversRequest;
use App\Http\Requests\ShowDriverRequest;
use App\Http\Resources\DriverResource;
use App\Http\Resources\DriverSummaryResource;
use App\Services\DriverCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DriverController extends Controller
{
    public function __construct(private readonly DriverCatalogService $catalog) {}

    public function index(SearchDriversRequest $request): AnonymousResourceCollection
    {
        $validated = $request->validated();
        $result = $this->catalog->search(
            isset($validated['q']) ? (string) $validated['q'] : null,
            array_intersect_key($validated, array_flip(SearchDriversRequest::FILTERS)),
            (int) ($validated['offset'] ?? 0),
        );

        return DriverSummaryResource::collection($result['drivers'])->additional([
            'meta' => [
                'limit' => DriverCatalogService::LIMIT,
                'has_more' => $result['hasMore'],
            ],
        ]);
    }

    public function brands(): JsonResponse
    {
        return response()->json(['data' => $this->catalog->brands()]);
    }

    public function show(ShowDriverRequest $request): DriverResource
    {
        $driver = $this->catalog->find((string) $request->validated('id'));

        abort_if($driver === null, 404, 'Driver não encontrado.');

        return new DriverResource($driver);
    }
}
