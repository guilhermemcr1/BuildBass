<?php

namespace App\Filament\Widgets;

use App\Enums\SubmissionStatus;
use App\Filament\Resources\DriverSubmissions\DriverSubmissionResource;
use App\Services\DashboardMetrics;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** Cartões do painel inicial: catálogo, fila de revisão e uso da leitura de manual por IA. */
class OperationOverview extends StatsOverviewWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 1;

    protected ?string $pollingInterval = null;

    /** @return array<int, Stat> */
    protected function getStats(): array
    {
        $metrics = app(DashboardMetrics::class);
        $rate = $metrics->approvalRate();

        $stats = [
            Stat::make('Drivers no catálogo', number_format($metrics->driversTotal(), 0, ',', '.')),
            Stat::make('Envios pendentes', number_format($metrics->pending(), 0, ',', '.'))
                ->description('Abrir a fila de revisão')
                ->url(DriverSubmissionResource::getUrl('index', [
                    'filters' => ['status' => ['value' => SubmissionStatus::Pending->value]],
                ])),
            Stat::make('Taxa de aprovação', $rate === null ? '—' : round($rate * 100).'%')
                ->description($rate === null ? 'Ainda sem decisões' : 'Aprovados entre os decididos'),
        ];

        $usage = $metrics->manualUsage();

        if (! $usage['enabled']) {
            return [...$stats, Stat::make('Uso da IA', 'Leitura por IA desativada')
                ->description('Ligue MANUAL_EXTRACTION_ENABLED e configure a chave do provedor')];
        }

        $quota = $usage['quota_percent'] === null
            ? "{$usage['quota_used']} de {$usage['quota_cap']}"
            : "{$usage['quota_used']} de {$usage['quota_cap']} (".rtrim(rtrim(number_format($usage['quota_percent'], 1, ',', ''), '0'), ',').'%)';

        return [
            ...$stats,
            Stat::make('Leituras de manual hoje', $usage['today']['reads'])
                ->description("{$usage['today']['failures']} falha(s) · {$usage['today']['blocked']} bloqueio(s)"),
            Stat::make('Cota diária da IA', $quota)
                ->description('Consumida hoje (zera à meia-noite local)'),
            Stat::make('Leituras em 30 dias', $usage['days30']['reads'])
                ->description("{$usage['days30']['failures']} falha(s) · {$usage['days30']['blocked']} bloqueio(s)"),
        ];
    }
}
