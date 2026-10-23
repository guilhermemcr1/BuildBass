<?php

use App\Models\AuditEvent;
use App\Models\DriverSubmission;
use App\Services\DashboardMetrics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class)->group('slow');

// SC-005: o painel continua rápido com a base grande. Fora da suíte padrão: só roda com
// `RUN_SLOW_TESTS=1 vendor/bin/pest --group=slow`.
it('as consultas do painel terminam abaixo de 3 s com 10 mil envios e 100 mil eventos', function () {
    // Em blocos, para não segurar 100 mil linhas na memória.
    $submission = DriverSubmission::factory()->make()->getAttributes();
    foreach (range(0, 19) as $chunk) {
        $rows = [];
        foreach (range(1, 500) as $n) {
            $i = $chunk * 500 + $n;
            $rows[] = array_merge($submission, [
                'id' => (string) Str::uuid(), 'dedupe_key' => hash('sha256', "envio-{$i}"), 'brand' => "Marca {$i}",
                'status' => ['pending', 'approved', 'rejected'][$i % 3],
                'created_at' => now()->subDays($i % 60), 'updated_at' => now(),
            ]);
        }
        DB::table('driver_submissions')->insert($rows);
    }

    $event = AuditEvent::factory()->manualRead()->make(['created_at' => now()])->getAttributes();
    foreach (range(0, 199) as $chunk) {
        $rows = [];
        foreach (range(1, 500) as $n) {
            $i = $chunk * 500 + $n;
            $rows[] = array_merge($event, [
                'id' => (string) Str::uuid(), 'type' => $i % 2 ? 'manual_read' : 'login',
                'created_at' => now()->subDays($i % 60),
            ]);
        }
        DB::table('audit_events')->insert($rows);
    }

    $metrics = app(DashboardMetrics::class);
    $started = microtime(true);

    $metrics->submissionsPerDay();
    $metrics->submissionsByStatus();
    $metrics->approvalRate();
    $metrics->manualUsage();
    $metrics->manualReadsPerDay();
    $metrics->driversTotal();

    expect(microtime(true) - $started)->toBeLessThan(3.0);
})->skip(fn () => ! env('RUN_SLOW_TESTS'), 'carga pesada: defina RUN_SLOW_TESTS=1');
