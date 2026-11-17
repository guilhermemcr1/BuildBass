<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\AuditEvents\AuditEventResource;
use App\Services\DashboardMetrics;
use Filament\Support\Enums\FontFamily;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Support\Carbon;

/** IPs com mais tentativas barradas na semana; clicar leva à trilha filtrada por aquele IP. */
class SuspiciousIpsTable extends TableWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 7;

    protected int|string|array $columnSpan = 1;

    public function table(Table $table): Table
    {
        return $table
            ->heading('IPs com mais tentativas barradas')
            ->description('Últimos 7 dias: anti-robô, recusas e leituras de manual bloqueadas')
            ->records(fn (): array => collect(app(DashboardMetrics::class)->suspiciousIps())
                ->keyBy('ip')
                ->all())
            ->paginated(false)
            ->emptyStateHeading('Nenhuma tentativa barrada')
            ->emptyStateDescription('Nenhum IP teve envio barrado nos últimos 7 dias.')
            ->columns([
                TextColumn::make('ip')->label('IP')->fontFamily(FontFamily::Mono)->copyable(),
                TextColumn::make('attempts')->label('Tentativas')->numeric()->badge()->color('danger'),
                TextColumn::make('last_seen')
                    ->label('Última')
                    ->state(fn (array $record): string => Carbon::parse($record['last_seen'], 'UTC')
                        ->setTimezone((string) config('app.display_timezone'))
                        ->format('d/m H:i')),
            ])
            ->recordUrl(fn (array $record): string => AuditEventResource::getUrl('index', [
                'filters' => ['ip' => ['value' => $record['ip']]],
            ]));
    }
}
