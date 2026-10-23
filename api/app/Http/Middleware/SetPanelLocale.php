<?php

namespace App\Http\Middleware;

use Carbon\Carbon;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * O painel de moderação é só em português: força pt_BR (textos do Filament, mensagens de validação
 * e datas), seja qual for o `APP_LOCALE` do servidor. A API pública não passa por aqui.
 */
class SetPanelLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        app()->setLocale('pt_BR');
        Carbon::setLocale('pt_BR');

        return $next($request);
    }
}
