<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Filament\Actions\Action;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();
        $this->configureFilament();
    }

    /**
     * Catálogo de drivers: 60 pedidos por minuto por IP; envio de driver: 5 por hora por IP
     * (a chave é guardada com hash).
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('catalog', fn (Request $request) => Limit::perMinute(60)->by((string) $request->ip()));
        RateLimiter::for('submission', fn (Request $request) => Limit::perHour(5)->by((string) $request->ip()));
    }

    /**
     * Dialogs do painel: clicar fora não fecha (um motivo de rejeição digitado não se perde sem
     * querer); fechar é pelo botão, pelo X ou pela tecla Esc.
     */
    protected function configureFilament(): void
    {
        Action::configureUsing(fn (Action $action) => $action->closeModalByClickingAway(false));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
