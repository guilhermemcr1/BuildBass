<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\AuditEvents\AuditEventResource;
use App\Services\DashboardMetrics;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** Cartões de segurança dos envios públicos nas últimas 24 h. */
class SubmissionSecurityOverview extends StatsOverviewWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 5;

    protected ?string $heading = 'Segurança dos envios (últimas 24 h)';

    protected ?string $pollingInterval = null;

    /** @return array<int, Stat> */
    protected function getStats(): array
    {
        $day = app(DashboardMetrics::class)->submissionAttemptsLastDay();
        $attempts = $day['accepted'] + $day['refused'] + $day['bot'];
        $reasons = collect($day['reasons'])
            ->map(fn (int $total, string $reason): string => $total.' '.mb_strtolower((string) __("audit.reasons.{$reason}")))
            ->implode(' · ');

        return [
            Stat::make('Tentativas de envio', $attempts)
                ->icon(Heroicon::OutlinedInboxArrowDown)
                ->description($attempts === 0 ? 'Nenhuma tentativa' : round($day['accepted'] / $attempts * 100).'% aceitas'),
            Stat::make('Envios recusados', $day['refused'])
                ->icon(Heroicon::OutlinedNoSymbol)
                ->description($reasons === '' ? 'Nenhuma recusa' : $reasons)
                ->color($day['refused'] > 0 ? 'warning' : 'gray'),
            Stat::make('Barrados pelo anti-robô', $day['bot'])
                ->icon(Heroicon::OutlinedShieldExclamation)
                ->description("{$day['suspicious_ips']} IP(s) com tentativas barradas")
                ->color($day['bot'] > 0 ? 'danger' : 'gray')
                ->url(AuditEventResource::getUrl('index', ['filters' => ['type' => ['values' => ['bot_blocked']]]])),
            Stat::make('IPs bloqueados por abuso', $day['abuse_blocks'])
                ->icon(Heroicon::OutlinedLockClosed)
                ->description('Bloqueio automático após '.config('abuse.max_strikes').' faltas em '.config('abuse.window_minutes').' min')
                ->color($day['abuse_blocks'] > 0 ? 'danger' : 'gray'),
        ];
    }
}
