<?php

use App\Filament\Resources\Drivers\Pages\CreateDriver;
use App\Models\AuditEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;

uses(RefreshDatabase::class);

beforeEach(function () {
    signInModerator();
    $this->withoutDefer();
});

it('preenche o cadastro com a sugestão da IA, sem guardar o PDF', function () {
    fakeManualPipeline();
    Storage::fake('local');

    Livewire::test(CreateDriver::class)
        ->callAction('readManual', ['manual' => manualPdf()])
        ->assertHasNoActionErrors()
        ->assertNotified()
        ->assertSet('data.brand', 'Triton')
        ->assertSet('data.model', 'TR 620')
        ->assertSet('data.type', 'woofer')
        ->assertSet('data.fs_hz', 76.94)
        ->assertSet('data.qts', 0.717)
        // A sugestão está em SI; o formulário mostra mm, L, cm² e g, sem casas de sobra.
        ->assertSet('data.nominal_diameter_m', 304.8)
        ->assertSet('data.xmax_m', 6.35)
        ->assertSet('data.vas_m3', 26.348)
        ->assertSet('data.sd_m2', 530.9)
        ->assertSet('data.mms_kg', 63.92);

    Http::assertSentCount(1);
    expect(Storage::disk('local')->allFiles())->toBe([])
        ->and(AuditEvent::query()->where('type', 'manual_read')->count())->toBe(1);
});

it('não apaga o que o moderador já digitou quando a IA não acha o campo', function () {
    fakeManualPipeline();

    Livewire::test(CreateDriver::class)
        ->fillForm(['re_ohm' => 3.2])
        ->callAction('readManual', ['manual' => manualPdf()])
        ->assertSet('data.re_ohm', 3.2)
        ->assertSet('data.fs_hz', 76.94);
});

it('avisa valores suspeitos e fora da faixa', function () {
    fakeManualPipeline([manualDriverRead(['qts' => ['value' => 0.95, 'unit' => 'none'], 'vas' => ['value' => 900, 'unit' => 'm3']])]);

    Livewire::test(CreateDriver::class)
        ->callAction('readManual', ['manual' => manualPdf()])
        ->assertNotified('11 campos preenchidos pela IA')
        ->assertSet('data.vas_m3', 26.76); // fora da faixa na leitura: calculado de Fs, Mms e Sd
});

it('mostra o motivo quando a leitura falha e deixa o formulário como está', function () {
    fakeManualPipeline(provider: Http::response([], 500));

    Livewire::test(CreateDriver::class)
        ->callAction('readManual', ['manual' => manualPdf()])
        ->assertNotified('Não foi possível ler o manual')
        ->assertSet('data.brand', null);
});

it('fica desligada quando a leitura por IA não está configurada', function () {
    config(['manual_extraction.enabled' => false]);

    Livewire::test(CreateDriver::class)->assertActionDisabled('readManual');
});

it('insere sozinho o que dá para calcular dos valores lidos no manual', function () {
    // Sem Qts na leitura: ele sai de Qes e Qms.
    fakeManualPipeline([manualDriverRead(['qts' => ['value' => null, 'unit' => null]])]);

    Livewire::test(CreateDriver::class)
        ->callAction('readManual', ['manual' => manualPdf()])
        ->assertSet('data.qts', 0.7168)
        ->assertSet('data.auto_keys', ['qts'])
        ->assertNotified('11 campos preenchidos pela IA');
});

it('ao digitar, o campo calculado entra e é refeito quando a origem muda', function () {
    Livewire::test(CreateDriver::class)
        ->set('data.qes', 0.44)
        ->set('data.qms', 8.37)
        ->assertSet('data.qts', 0.418)
        ->assertSet('data.auto_keys', ['qts'])
        ->set('data.qms', 4)
        ->assertSet('data.qts', 0.3964)
        // Digitar no próprio campo calculado o torna "digitado": deixa de se atualizar.
        ->set('data.qts', 0.5)
        ->assertSet('data.auto_keys', [])
        ->set('data.qms', 8.37)
        ->assertSet('data.qts', 0.5);
});
