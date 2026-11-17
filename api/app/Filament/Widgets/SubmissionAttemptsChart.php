<?php

namespace App\Filament\Widgets;

use App\Services\DashboardMetrics;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class SubmissionAttemptsChart extends ChartWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 6;

    protected ?string $heading = 'Tentativas de envio por dia';

    protected ?string $description = 'Últimos 30 dias: aceitos, recusados e barrados pelo anti-robô';

    protected ?string $pollingInterval = null;

    protected function getType(): string
    {
        return 'bar';
    }

    /** @return array<string, mixed> */
    protected function getData(): array
    {
        $series = app(DashboardMetrics::class)->submissionAttemptsPerDay();

        return [
            'datasets' => [
                ['label' => 'Aceitos', 'data' => array_values($series['accepted']), 'backgroundColor' => '#22c55e', 'stack' => 'envios'],
                ['label' => 'Recusados', 'data' => array_values($series['refused']), 'backgroundColor' => '#f59e0b', 'stack' => 'envios'],
                ['label' => 'Anti-robô', 'data' => array_values($series['bot']), 'backgroundColor' => '#ef4444', 'stack' => 'envios'],
            ],
            'labels' => array_map(fn (string $day): string => Carbon::parse($day)->format('d/m'), array_keys($series['accepted'])),
        ];
    }

    /** @return array<string, mixed> */
    protected function getOptions(): array
    {
        return [
            'scales' => [
                'x' => ['stacked' => true],
                'y' => ['stacked' => true, 'beginAtZero' => true, 'ticks' => ['precision' => 0]],
            ],
        ];
    }
}
