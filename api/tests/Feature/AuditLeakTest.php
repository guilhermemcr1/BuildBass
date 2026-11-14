<?php

use App\Filament\Resources\Drivers\Pages\EditDriver;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\Moderator;
use Filament\Auth\Pages\Login;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;

uses(RefreshDatabase::class);

// SC-004: depois de rodar os fluxos que gravam eventos, nada pessoal ou secreto pode estar em
// nenhuma coluna nem em nenhum JSON da trilha.
it('nenhum evento guarda senha, e-mail de contato, IP em claro, nome de PDF, texto de manual ou nome de imagem', function () {
    $this->withoutDefer();
    Storage::fake('public');
    Filament\Facades\Filament::setCurrentPanel('moderation');

    // 1. Login com senha errada e certa.
    $moderator = Moderator::factory()->create(['password' => 'senha-certa-123']);
    Livewire::test(Login::class)->fillForm(['email' => $moderator->email, 'password' => 'senha-errada-999'])->call('authenticate');
    Livewire::test(Login::class)->fillForm(['email' => $moderator->email, 'password' => 'senha-certa-123'])->call('authenticate');

    // 2. Envio público com e-mail de contato, de um IP conhecido.
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.23'])->postJson('/api/driver-submissions', [
        'brand' => 'Marca', 'model' => 'M-1', 'source' => 'Ficha', 'contact_email' => 'visitante-secreto@exemplo.com',
        'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.05, 'locale' => 'pt-BR',
    ])->assertCreated();

    // 3. Leitura de manual com PDF e texto distintivos.
    fakeManualPipeline(text: str_repeat("TEXTO-SECRETO-DO-MANUAL Qts 0,717 Fs 76,94 Hz Vas 26,348 L\n", 10));
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.23'])
        ->post('/api/driver-submissions/extract', ['manual' => manualPdf('ficha-confidencial.pdf')], ['Accept' => 'application/json'])
        ->assertOk();

    // 4. Bloqueio do anti-robô.
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.23'])
        ->postJson('/api/driver-submissions', ['website' => 'x'])->assertCreated();

    // 5. Imagem com nome original distintivo.
    if (function_exists('imagewebp')) {
        signInModerator($moderator);
        $driver = Driver::factory()->create();
        Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
            ->fillForm(['images' => [UploadedFile::fake()->image('foto-do-meu-celular-IMG_9999.jpg', 100, 100)]])
            ->call('save');
    }

    $dump = AuditEvent::all()->map(fn (AuditEvent $event) => json_encode($event->getAttributes()))->implode("\n");

    // Sem GD o passo 5 não roda e a trilha tem só os 5 eventos dos passos 1–4.
    expect(AuditEvent::count())->toBeGreaterThan(function_exists('imagewebp') ? 5 : 4);

    foreach ([
        'senha-errada-999', 'senha-certa-123', 'visitante-secreto@exemplo.com', '198.51.100.23',
        'ficha-confidencial', 'TEXTO-SECRETO-DO-MANUAL', 'IMG_9999', 'foto-do-meu-celular',
    ] as $forbidden) {
        expect($dump)->not->toContain($forbidden, "vazou: {$forbidden}");
    }
});
