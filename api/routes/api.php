<?php

use App\Http\Controllers\DriverController;
use App\Http\Controllers\DriverSubmissionController;
use App\Http\Controllers\ManualExtractionController;
use App\Http\Middleware\RejectAutomation;
use Illuminate\Support\Facades\Route;

// Rotas JSON consumidas pelo front (web/). O catálogo é só leitura; a única escrita pública é o
// envio de um driver para a fila de moderação (feature 006).
Route::middleware('throttle:catalog')->group(function () {
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::get('/driver-brands', [DriverController::class, 'brands']);
    Route::get('/drivers/{id}', [DriverController::class, 'show']);
});

// Ordem: limite de frequência → armadilha e anti-robô → validação → duplicata (contrato do envio).
Route::middleware(['throttle:submission', RejectAutomation::class])
    ->post('/driver-submissions', [DriverSubmissionController::class, 'store']);

// Leitura assistida de manual (feature 009): devolve uma sugestão para pré-preencher o formulário e
// não grava nada. Os limites de uso (por hora e diário) contam dentro do service, depois da
// validação, para que anti-robô e arquivo inválido não consumam cota.
Route::middleware(['throttle:catalog', RejectAutomation::class])
    ->post('/driver-submissions/extract', [ManualExtractionController::class, 'store']);
