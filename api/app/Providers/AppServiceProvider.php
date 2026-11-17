<?php

namespace App\Providers;

use App\Services\Security\SubmissionAttempts;
use Carbon\CarbonImmutable;
use Filament\Actions\Action;
use Filament\Support\Facades\FilamentTimezone;
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
     * (a chave é guardada com hash). O envio barrado pelo limite vai para a trilha e conta falta.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('catalog', fn (Request $request) => Limit::perMinute(60)->by((string) $request->ip()));
        RateLimiter::for('submission', fn (Request $request) => Limit::perHour(5)
            ->by((string) $request->ip())
            ->response(function (Request $request, array $headers) {
                app(SubmissionAttempts::class)->refused(SubmissionAttempts::REASON_THROTTLED, $request->ip());

                return response()->json([
                    'message' => (string) __('submission.throttled'),
                    'code' => 'too_many_attempts',
                ], 429, $headers);
            }));
    }

    /**
     * Dialogs do painel: clicar fora não fecha (um motivo de rejeição digitado não se perde sem
     * querer); fechar é pelo botão, pelo X ou pela tecla Esc. Datas e horas do painel no fuso de
     * quem modera (`app.display_timezone`), não no UTC do banco.
     */
    protected function configureFilament(): void
    {
        FilamentTimezone::set((string) config('app.display_timezone'));

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
