<?php

namespace App\Providers\Filament;

use App\Filament\Widgets\ManualUsageChart;
use App\Filament\Widgets\OperationOverview;
use App\Filament\Widgets\SubmissionsByStatusChart;
use App\Filament\Widgets\SubmissionsPerDayChart;
use App\Http\Middleware\SetPanelLocale;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\View\PanelsRenderHook;
use Illuminate\Contracts\View\View;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class ModerationPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        // Painel da moderação (specs/006, 010): só login de moderador, sem cadastro público. Início
        // com métricas de uso, mais envios, drivers e auditoria; o guard `moderator` usa a tabela
        // `moderators`.
        return $panel
            ->default()
            ->id('moderation')
            ->path('moderation')
            ->authGuard('moderator')
            ->brandName('BuildBass · Moderação')
            ->login()
            ->unsavedChangesAlerts()
            // Aviso de alterações não salvas em Dialog (o do Filament é o popup do navegador).
            ->renderHook(PanelsRenderHook::BODY_END, fn (): View => view('filament.unsaved-guard'))
            ->sidebarCollapsibleOnDesktop()
            // Idioma do painel também nas requisições do Livewire (salvar, filtrar, validar).
            ->middleware([SetPanelLocale::class], isPersistent: true)
            ->colors([
                'primary' => Color::Amber,
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->pages([Dashboard::class])
            ->widgets([
                OperationOverview::class,
                SubmissionsPerDayChart::class,
                SubmissionsByStatusChart::class,
                ManualUsageChart::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
