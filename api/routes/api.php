<?php

use App\Http\Controllers\DriverController;
use App\Http\Controllers\DriverSubmissionController;
use Illuminate\Support\Facades\Route;

// Rotas JSON consumidas pelo front (web/). O catálogo é só leitura; a única escrita pública é o
// envio de um driver para a fila de moderação (feature 006).
Route::middleware('throttle:catalog')->group(function () {
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::get('/drivers/{id}', [DriverController::class, 'show']);
});

Route::middleware('throttle:submission')->post('/driver-submissions', [DriverSubmissionController::class, 'store']);
