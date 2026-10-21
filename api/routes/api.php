<?php

use App\Http\Controllers\DriverController;
use App\Http\Controllers\DriverSubmissionController;
use App\Http\Middleware\RejectAutomation;
use Illuminate\Support\Facades\Route;

// Rotas JSON consumidas pelo front (web/). O catálogo é só leitura; a única escrita pública é o
// envio de um driver para a fila de moderação (feature 006).
Route::middleware('throttle:catalog')->group(function () {
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::get('/drivers/{id}', [DriverController::class, 'show']);
});

// Ordem: limite de frequência → armadilha e anti-robô → validação → duplicata (contrato do envio).
Route::middleware(['throttle:submission', RejectAutomation::class])
    ->post('/driver-submissions', [DriverSubmissionController::class, 'store']);
