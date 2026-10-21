<?php

use App\Http\Controllers\DriverController;
use Illuminate\Support\Facades\Route;

// Rotas JSON consumidas pelo front (web/). O catálogo é só leitura; envios chegam em feature própria.
Route::middleware('throttle:catalog')->group(function () {
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::get('/drivers/{id}', [DriverController::class, 'show']);
});
