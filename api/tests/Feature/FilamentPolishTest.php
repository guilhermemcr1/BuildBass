<?php

use App\Filament\Resources\AuditEvents\Pages\ListAuditEvents;
use App\Filament\Resources\Drivers\Pages\CreateDriver;
use App\Filament\Resources\Drivers\Pages\EditDriver;
use App\Filament\Resources\Drivers\Pages\ListDrivers;
use App\Filament\Resources\DriverSubmissions\Pages\ListDriverSubmissions;
use App\Filament\Schemas\RangedNumberInput;
use App\Models\Driver;
use App\Services\DriverService;
use Filament\Actions\Action;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

beforeEach(function () {
    signInModerator();
});

it('o painel fala português mesmo com APP_LOCALE em inglês', function () {
    app()->setLocale('en');

    $this->get('/moderation/drivers/novo')->assertOk();

    expect(app()->getLocale())->toBe('pt_BR');
});

it('mostra o esquema do alto-falante com as cotas A a G na tela de novo driver', function () {
    $this->get('/moderation/drivers/novo')
        ->assertOk()
        ->assertSee('Esquema do alto-falante em corte')
        ->assertSee('Clique em um campo de medida')
        ->assertSee('Aro externo')
        ->assertSee('Profundidade total')
        ->assertSee('dim-focus', false);
});

it('o esquema só mostra a cota D no formato retangular', function () {
    $round = $this->get('/moderation/drivers/novo')->assertOk()->getContent();
    expect($round)->not->toContain('x2="258"')->not->toContain('placeholder="Ex.: 0.18"');

    $driver = Driver::factory()->withDimensions()->create(['drv_shape' => 'rect', 'drv_d_m' => 0.2]);
    $this->get("/moderation/drivers/{$driver->id}/editar")->assertOk()->assertSee('x2="258"', false)->assertSee('placeholder="Ex.: 0.18"', false);
});

it('mensagens de erro em português, com a faixa legível e sem notação científica', function () {
    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => '', 'vas_m3' => 0, 'drv_a_m' => 5])
        ->call('create')
        ->assertHasFormErrors([
            'brand' => 'Informe o fabricante.',
            'vas_m3' => 'Valor abaixo do mínimo. Informe entre 0.001 a 10000 L.',
            'drv_a_m' => 'Valor acima do máximo. Informe entre 0.03 a 1.5 m.',
        ]);
});

it('campos numéricos mostram exemplo e a faixa no tooltip, sem texto fixo embaixo', function () {
    $this->get('/moderation/drivers/novo')
        ->assertOk()
        ->assertSee('Ex.: 40', false)
        ->assertSee('Faixa: 1 a 20000 Hz.', false)
        ->assertSee('Faixa: 0.001 a 10000 L.', false)
        ->assertDontSee('Faixa: 1.0E-6', false);
});

it('formata a faixa sem notação científica', function () {
    expect(RangedNumberInput::plain(1e-6))->toBe('0.000001')
        ->and(RangedNumberInput::plain(20000))->toBe('20000')
        ->and(RangedNumberInput::plain(0.0001))->toBe('0.0001')
        ->and(RangedNumberInput::plain(0))->toBe('0');
});

it('duplicata aparece no campo, não só em aviso', function () {
    Driver::factory()->create(['brand' => 'Triton', 'model' => 'TR 620', 'variant' => '']);

    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => 'Triton', 'model' => 'TR 620', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08, 'source' => 'ficha'])
        ->call('create')
        ->assertHasFormErrors(['brand', 'model'])
        ->assertNotified('Driver já cadastrado');

    expect(Driver::count())->toBe(1);
});

it('erro do service em chave crua vai para o campo do formulário', function () {
    if (! function_exists('imagewebp')) {
        $this->markTestSkipped('GD sem suporte a WebP: o campo de imagens fica desativado.');
    }

    $driver = Driver::factory()->create();

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->fillForm(['images' => ['driver-images/fora-do-padrao.png']])
        ->call('save')
        ->assertHasFormErrors(['images']);
});

it('falha inesperada vira aviso e nada é gravado', function () {
    $this->mock(DriverService::class)->shouldReceive('create')->andThrow(new RuntimeException('banco fora'));

    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => 'X', 'model' => 'Y', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08, 'source' => 'ficha'])
        ->call('create')
        ->assertNotified('Não foi possível salvar');

    expect(Driver::count())->toBe(0);
});

it('tabelas vazias explicam o que fazer', function () {
    Livewire::test(ListDrivers::class)->assertSee('Nenhum driver encontrado')->assertSee('Novo driver');
    Livewire::test(ListDriverSubmissions::class)->assertSee('Nenhum envio nesta situação');
    Livewire::test(ListAuditEvents::class)->assertSee('Nenhum evento encontrado');
});

it('a mensagem de campo obrigatório vem em português na validação do framework', function () {
    app()->setLocale('pt_BR');

    $validator = validator(['name' => ''], ['name' => 'required']);
    $validator->fails();

    expect($validator->errors()->first('name'))->toBe('Preencha o campo nome.');
});

it('o símbolo da unidade vem escrito no sufixo e descrito na ajuda', function () {
    $this->get('/moderation/drivers/novo')
        ->assertOk()
        ->assertSee('Unidade: Hz (hertz).', false)
        ->assertSee('Unidade: Ω (ohms).', false)
        ->assertSee('Unidade: T·m (tesla-metro).', false)
        ->assertSee('Unidade: mm (milímetros).', false)
        ->assertSee('Unidade: mH (milihenries).', false)
        ->assertSee('Adimensional, sem unidade.', false)
        ->assertDontSee('Fs (Hz)');
});

it('a variante pede só a impedância e grava com o símbolo Ω', function (string $typed, string $stored) {
    $payload = ['brand' => 'Triton', 'model' => 'TR 620', 'variant' => $typed, 'source' => 'Ficha técnica', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08];

    Livewire::test(CreateDriver::class)->fillForm($payload)->call('create')->assertHasNoFormErrors();

    expect(Driver::query()->sole()->variant)->toBe($stored);
})->with([
    'inteiro' => ['4', '4 Ω'],
    'decimal com vírgula' => ['3,2', '3.2 Ω'],
    'zeros sobrando' => ['8.00', '8 Ω'],
    'com o símbolo' => ['4 Ω', '4 Ω'],
]);

it('a variante recusa texto e valores fora da faixa', function (string $typed) {
    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => 'Triton', 'model' => 'TR 620', 'variant' => $typed, 'source' => 'Ficha técnica', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08])
        ->call('create')
        ->assertHasFormErrors(['variant']);

    expect(Driver::count())->toBe(0);
})->with(['DVC', '4 ohms extra', '0', '100', '-4', '4..5']);

it('a variante de um driver existente aparece só como número', function () {
    $driver = Driver::factory()->create(['variant' => '4 Ω']);

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->assertFormSet(['variant' => '4'])
        ->call('save')
        ->assertHasNoFormErrors();

    expect($driver->fresh()->variant)->toBe('4 Ω');
});

it('fabricante e modelo recusam símbolos soltos e normalizam espaços', function () {
    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => 'Tri<ton>', 'model' => 'TR 620 😀', 'source' => 'Ficha técnica', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08])
        ->call('create')
        ->assertHasFormErrors(['brand', 'model']);

    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => '  Triton   Audio ', 'model' => 'TR  620 12"', 'source' => '  Ficha   técnica ', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08])
        ->call('create')
        ->assertHasNoFormErrors();

    $driver = Driver::query()->sole();
    expect($driver->brand)->toBe('Triton Audio')->and($driver->model)->toBe('TR 620 12"')->and($driver->source)->toBe('Ficha técnica');
});

it('a fonte precisa de pelo menos 3 caracteres', function () {
    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => 'Triton', 'model' => 'TR 620', 'source' => 'x', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08])
        ->call('create')
        ->assertHasFormErrors(['source']);
});

it('o formulário do driver é dividido em abas', function () {
    $this->get('/moderation/drivers/novo')
        ->assertOk()
        ->assertSeeInOrder(['Identificação', 'Parâmetros', 'Dimensões', 'Imagens']);
});

it('a aba com campo inválido recebe o selo de erro', function () {
    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => 'Triton', 'model' => 'TR 620', 'source' => 'Ficha técnica', 'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08, 'drv_a_m' => 5, 'drv_g_m' => 5])
        ->call('create')
        ->assertHasFormErrors(['drv_a_m', 'drv_g_m'])
        ->assertSeeHtml('fi-badge');
});

it('Cancelar é um link e o aviso de alterações não salvas é um Dialog do Filament', function () {
    $driver = Driver::factory()->create();

    $this->get("/moderation/drivers/{$driver->id}/editar")
        ->assertOk()
        ->assertSee('Descartar as alterações?')
        ->assertSee('Continuar editando')
        ->assertSee('Descartar e sair')
        ->assertSee('window.unsavedGuard', false)
        ->assertSeeHtml('href="'.url('/moderation/drivers').'"')
        ->assertDontSee('document.referrer', false);
});

it('os dialogs do painel não fecham ao clicar fora', function () {
    expect(Action::make('x')->requiresConfirmation()->isModalClosedByClickingAway())->toBeFalse();
});

it('os parâmetros aparecem e são digitados na unidade das fichas, mas gravados em SI', function () {
    signInModerator();

    Livewire::test(CreateDriver::class)
        ->fillForm([
            'brand' => 'Tormento', 'model' => '12" SBW 650W', 'source' => 'Manual do produto',
            'fs_hz' => 28.93, 'qts' => 0.41, 'vas_m3' => 66.15, 'le_h' => 3.89, 'xmax_m' => 9,
            'sd_m2' => 400, 'mms_kg' => 154.76, 'vd_m3' => 360, 'nominal_diameter_m' => 304.8,
        ])
        ->call('create')
        ->assertHasNoFormErrors();

    $driver = Driver::query()->sole();
    expect($driver->vas_m3)->toBe(0.06615)
        ->and($driver->le_h)->toBe(0.00389)
        ->and($driver->xmax_m)->toBe(0.009)
        ->and($driver->sd_m2)->toBe(0.04)
        ->and($driver->mms_kg)->toBe(0.15476)
        ->and($driver->vd_m3)->toBe(0.00036)
        ->and($driver->nominal_diameter_m)->toBe(0.3048);

    // Na edição, o que está em SI volta nas mesmas unidades, sem casas de sobra.
    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->assertSet('data.le_h', 3.89)
        ->assertSet('data.xmax_m', 9.0)
        ->assertSet('data.vas_m3', 66.15)
        ->assertSet('data.sd_m2', 400.0);
});
