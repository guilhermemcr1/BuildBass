<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * O "dia" de quem usa e modera o BuildBass: o fuso de exibição (`app.display_timezone`, padrão
 * America/Sao_Paulo), não o UTC em que o app e o banco gravam. Cotas diárias da IA, o "hoje" e os
 * gráficos por dia do painel viram à meia-noite local, e não às 21h (meia-noite UTC).
 */
final class LocalDay
{
    public static function timezone(): string
    {
        return (string) config('app.display_timezone');
    }

    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone());
    }

    /** `Y-m-d` do dia local de hoje (ou de `$daysAgo` dias atrás). */
    public static function key(int $daysAgo = 0): string
    {
        return self::now()->subDays($daysAgo)->format('Y-m-d');
    }

    /** Fim do dia local: validade das cotas diárias no cache. */
    public static function end(): CarbonImmutable
    {
        return self::now()->endOfDay();
    }

    /** Meia-noite local de hoje (ou de `$daysAgo` dias atrás), em UTC para comparar com o banco. */
    public static function startUtc(int $daysAgo = 0): CarbonImmutable
    {
        return self::now()->subDays($daysAgo)->startOfDay()->utc();
    }

    /**
     * Expressão SQL do dia local (`Y-m-d`) de `created_at`, gravado em UTC, com o deslocamento de
     * agora em minutos como binding (não depende das tabelas de fuso do banco).
     *
     * @return array{0: literal-string, 1: list<int|string>}
     */
    public static function createdDateSql(): array
    {
        $minutes = self::now()->utcOffset();

        return match (DB::connection()->getDriverName()) {
            'sqlite' => ['DATE(created_at, ?)', ["{$minutes} minutes"]],
            'pgsql' => ['DATE(created_at + make_interval(mins => ?))', [$minutes]],
            default => ['DATE(DATE_ADD(created_at, INTERVAL ? MINUTE))', [$minutes]],
        };
    }
}
