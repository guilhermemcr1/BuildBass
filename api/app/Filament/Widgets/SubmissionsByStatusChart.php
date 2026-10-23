<?php

namespace App\Filament\Widgets;

use App\Services\DashboardMetrics;
use Filament\Widgets\ChartWidget;

class SubmissionsByStatusChart extends ChartWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 3;

    protected ?string $heading = 'Envios por situação';

    protected ?string $pollingInterval = null;

    protected function getType(): string
    {
        return 'doughnut';
    }

    /** @return array<string, mixed> */
    protected function getData(): array
    {
        $status = app(DashboardMetrics::class)->submissionsByStatus();

        return [
            'datasets' => [[
                'data' => [$status['pending'], $status['approved'], $status['rejected']],
                'backgroundColor' => ['#f59e0b', '#22c55e', '#ef4444'],
            ]],
            'labels' => ['Pendente', 'Aprovado', 'Rejeitado'],
        ];
    }
}
