<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('PDF sem texto legível responde unreadable em pt-BR e em inglês', function () {
    fakeManualPipeline(text: '12');

    postManual(['locale' => 'pt-BR'])->assertStatus(422)
        ->assertJsonPath('code', 'unreadable')
        ->assertJsonPath('message', 'Este PDF não tem texto que possa ser lido (pode ser uma imagem). Preencha os campos à mão.');

    postManual(['locale' => 'en'], '203.0.113.8')->assertStatus(422)
        ->assertJsonPath('message', 'This PDF has no readable text (it may be an image). Fill in the fields by hand.');
});

it('falha da IA responde provider_failed sem vazar chave, modelo ou texto', function () {
    fakeManualPipeline(provider: Http::response(['error' => 'segredo interno'], 500));

    $response = postManual()->assertStatus(502)->assertJsonPath('code', 'provider_failed');

    expect($response->getContent())->not->toContain('chave-secreta')
        ->and($response->getContent())->not->toContain('modelo-barato')
        ->and($response->getContent())->not->toContain('segredo interno')
        ->and($response->getContent())->not->toContain('Qts 0,717');
});

it('recurso desligado ou sem chave/modelo responde unavailable sem erro', function (string $setting, mixed $value) {
    fakeManualPipeline();
    config([$setting => $value]);

    postManual()->assertStatus(503)->assertJsonPath('code', 'unavailable');

    Http::assertNothingSent();
})->with([
    'desligado' => ['manual_extraction.enabled', false],
    'sem chave' => ['services.openrouter.key', ''],
    'sem modelo' => ['services.openrouter.model', null],
]);

it('arquivo inválido responde invalid_file com o motivo', function (callable $file, string $reason) {
    fakeManualPipeline();

    postManual(['manual' => $file()])->assertStatus(422)
        ->assertJsonPath('code', 'invalid_file')
        ->assertJsonPath('errors.manual', [$reason]);
})->with([
    'ausente' => [fn () => null, 'required'],
    'não é PDF' => [fn () => UploadedFile::fake()->create('foto.png', 10, 'image/png'), 'not_pdf'],
    'texto com extensão pdf' => [function () {
        $path = tempnam(sys_get_temp_dir(), 'manual');
        file_put_contents($path, 'só texto, não é PDF');

        return new UploadedFile($path, 'x.pdf', 'application/pdf', null, true);
    }, 'not_pdf'],
    'grande demais' => [fn () => manualPdf(kilobytes: 10241), 'too_large'],
]);

it('PDF com mais de 30 páginas responde too_many_pages', function () {
    fakeManualPipeline(pages: 31);

    postManual()->assertStatus(422)
        ->assertJsonPath('code', 'invalid_file')
        ->assertJsonPath('errors.manual', ['too_many_pages']);
});

it('não deixa PDF, texto nem resposta da IA gravados, nem depois de um erro', function () {
    fakeManualPipeline(provider: Http::response([], 500));
    Storage::fake('local');
    Log::spy();

    postManual()->assertStatus(502);

    expect(Storage::disk('local')->allFiles())->toBe([]);

    Log::shouldHaveReceived('info')->withArgs(fn (string $message, array $context) => $message === 'manual_extraction'
        && $context['outcome'] === 'provider_failed'
        && ! str_contains(json_encode($context), 'Qts'));
});

it('o envio manual de driver continua funcionando com o recurso indisponível', function () {
    fakeManualPipeline();
    config(['manual_extraction.enabled' => false]);

    postManual()->assertStatus(503);

    $this->postJson('/api/driver-submissions', [
        'brand' => 'Marca', 'model' => 'M-1', 'source' => 'Ficha', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.05,
        'contact_email' => 'pessoa@exemplo.com',
    ])->assertCreated();
});
