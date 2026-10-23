<?php

namespace App\Filament\Widgets;

use App\Services\DashboardMetrics;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class SubmissionsPerDayChart extends ChartWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 2;

    protected ?string $heading = 'Envios por dia';

    protected ?string $description = 'Últimos 30 dias';

    protected ?string $pollingInterval = null;

    protected function getType(): string
    {
        return 'bar';
    }

    /** @return array<string, mixed> */
    protected function getData(): array
    {
        $days = app(DashboardMetrics::class)->submissionsPerDay();

        return [
            'datasets' => [['label' => 'Envios', 'data' => array_values($days)]],
            'labels' => array_map(fn (string $day): string => Carbon::parse($day)->format('d/m'), array_keys($days)),
        ];
    }
}
