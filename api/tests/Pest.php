<?php

use Illuminate\Http\Testing\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature', 'Unit');

// Leitura de manual (feature 009): PDF mínimo, processos do poppler e OpenRouter simulados.
function manualPdf(string $name = 'ficha.pdf', int $kilobytes = 1): File
{
    return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n".str_repeat('0', $kilobytes * 1024));
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function manualDriverRead(array $overrides = []): array
{
    return array_merge([
        'brand' => 'Triton',
        'model' => 'TR 620',
        'variant' => null,
        'type' => 'woofer',
        'nominal_diameter' => ['value' => 12, 'unit' => 'in'],
        'fs' => ['value' => 76.94, 'unit' => 'Hz'],
        'qts' => ['value' => 0.717, 'unit' => 'none'],
        'vas' => ['value' => 26.348, 'unit' => 'L'],
        'qes' => ['value' => 0.779, 'unit' => 'none'],
        'qms' => ['value' => 8.978, 'unit' => 'none'],
        'sd' => ['value' => 530.9, 'unit' => 'cm2'],
        'xmax' => ['value' => 6.35, 'unit' => 'mm'],
        'mms' => ['value' => 63.92, 'unit' => 'g'],
    ], $overrides);
}

/**
 * Liga o recurso e simula pdfinfo, pdftotext e o OpenRouter.
 *
 * @param  list<array<string, mixed>>|null  $drivers  resposta da IA (padrão: um driver)
 * @param  mixed  $provider  resposta pronta do OpenRouter, no lugar de `$drivers` (erro, conteúdo inválido…)
 */
function fakeManualPipeline(?array $drivers = null, int $pages = 3, ?string $text = null, mixed $provider = null): void
{
    config([
        'manual_extraction.enabled' => true,
        'services.openrouter.key' => 'chave-secreta',
        'services.openrouter.model' => 'fabricante/modelo-barato',
        'services.openrouter.base_url' => 'https://openrouter.test/api/v1',
    ]);

    Process::fake([
        '*pdfinfo*' => Process::result("Pages: {$pages}\n"),
        '*pdftotext*' => Process::result($text ?? str_repeat("Qts 0,717 | Fs 76,94 Hz | Vas 26,348 L\n", 10)),
    ]);

    $content = json_encode(['drivers' => $drivers ?? [manualDriverRead()]]);

    Http::fake([
        'openrouter.test/*' => $provider ?? Http::response(['choices' => [['message' => ['content' => $content]]]]),
    ]);
}

/** @param  array<string, mixed>  $extra */
function postManual(array $extra = [], string $ip = '203.0.113.7'): TestResponse
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip])
        ->post('/api/driver-submissions/extract', array_merge(['manual' => manualPdf()], $extra), ['Accept' => 'application/json']);
}
