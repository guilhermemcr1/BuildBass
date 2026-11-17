<?php

use App\Http\Middleware\BlockAbusiveSenders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Atrás de um proxy reverso (Traefik): confia nele para enxergar HTTPS e o IP real do cliente
        // (o limite por IP e o hash do remetente dependem disso).
        $middleware->trustProxies(at: '*');

        // O Laravel ordena middlewares por prioridade e o `throttle` viria antes: um IP bloqueado
        // por abuso precisa ser barrado antes de contar no limite (e de gerar linha na trilha).
        $middleware->prependToPriorityList(
            before: ThrottleRequests::class,
            prepend: BlockAbusiveSenders::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // A API responde sempre JSON; o painel de moderação (HTML) mantém os redirecionamentos.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
