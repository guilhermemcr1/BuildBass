<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchDriversRequest;
use App\Http\Requests\ShowDriverRequest;
use App\Http\Resources\DriverResource;
use App\Http\Resources\DriverSummaryResource;
use App\Services\DriverCatalogService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DriverController extends Controller
{
    public function __construct(private readonly DriverCatalogService $catalog) {}

    public function index(SearchDriversRequest $request): AnonymousResourceCollection
    {
        $result = $this->catalog->search((string) $request->validated('q'));

        return DriverSummaryResource::collection($result['drivers'])->additional([
            'meta' => [
                'limit' => DriverCatalogService::LIMIT,
                'has_more' => $result['hasMore'],
            ],
        ]);
    }

    public function show(ShowDriverRequest $request): DriverResource
    {
        $driver = $this->catalog->find((int) $request->validated('id'));

        abort_if($driver === null, 404, 'Driver não encontrado.');

        return new DriverResource($driver);
    }
}
