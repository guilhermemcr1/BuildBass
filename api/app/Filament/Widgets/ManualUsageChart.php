<?php

namespace App\Filament\Widgets;

use App\Services\DashboardMetrics;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class ManualUsageChart extends ChartWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 4;

    protected ?string $heading = 'Leituras de manual por dia';

    protected ?string $description = 'Últimos 30 dias: ok, falha e bloqueio';

    protected ?string $pollingInterval = null;

    protected int|string|array $columnSpan = 'full';

    protected function getType(): string
    {
        return 'line';
    }

    /** @return array<string, mixed> */
    protected function getData(): array
    {
        $series = app(DashboardMetrics::class)->manualReadsPerDay();

        return [
            'datasets' => [
                ['label' => 'Ok', 'data' => array_values($series['ok']), 'borderColor' => '#22c55e'],
                ['label' => 'Falha', 'data' => array_values($series['failed']), 'borderColor' => '#ef4444'],
                ['label' => 'Bloqueio', 'data' => array_values($series['blocked']), 'borderColor' => '#f59e0b'],
            ],
            'labels' => array_map(fn (string $day): string => Carbon::parse($day)->format('d/m'), array_keys($series['ok'])),
        ];
    }
}
