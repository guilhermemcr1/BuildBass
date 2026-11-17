<?php

use App\Http\Controllers\DriverController;
use App\Http\Controllers\DriverSubmissionController;
use App\Http\Controllers\ManualExtractionController;
use App\Http\Middleware\BlockAbusiveSenders;
use App\Http\Middleware\RejectAutomation;
use Illuminate\Support\Facades\Route;

// Rotas JSON consumidas pelo front (web/). O catálogo é só leitura; a única escrita pública é o
// envio de um driver para a fila de moderação.
// Cache de 60 s no navegador + ETag: o catálogo só muda quando um moderador aprova um driver, e
// repetir a mesma busca não gasta a cota do `throttle:catalog` nem toca no banco.
Route::middleware(['throttle:catalog', 'cache.headers:public;max_age=60;etag'])->group(function () {
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::get('/driver-brands', [DriverController::class, 'brands']);
    Route::get('/drivers/{id}', [DriverController::class, 'show']);
});

// Ordem: IP bloqueado por abuso → limite de frequência → armadilha e anti-robô → validação →
// duplicata (contrato do envio). O bloqueio vem antes do limite para um robô insistente não gerar
// uma linha de auditoria por tentativa.
Route::middleware([BlockAbusiveSenders::class, 'throttle:submission', RejectAutomation::class])
    ->post('/driver-submissions', [DriverSubmissionController::class, 'store']);

// Leitura assistida de manual: devolve uma sugestão para pré-preencher o formulário e
// não grava nada. Os limites de uso (por hora e diário) contam dentro do service, depois da
// validação, para que anti-robô e arquivo inválido não consumam cota.
Route::middleware([BlockAbusiveSenders::class, 'throttle:catalog', RejectAutomation::class])
    ->post('/driver-submissions/extract', [ManualExtractionController::class, 'store']);
