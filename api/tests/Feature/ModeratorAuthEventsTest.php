<?php

use App\Enums\AuditType;
use App\Models\AuditEvent;
use App\Models\Moderator;
use App\Models\User;
use App\Support\IpHash;
use Filament\Auth\Pages\Login;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;

uses(RefreshDatabase::class);

beforeEach(function () {
    Filament\Facades\Filament::setCurrentPanel('moderation');
});

it('login correto grava login com o autor e o IP em hash', function () {
    $moderator = Moderator::factory()->create(['password' => 'senha-certa-123']);

    Livewire::test(Login::class)
        ->fillForm(['email' => $moderator->email, 'password' => 'senha-certa-123'])
        ->call('authenticate')
        ->assertHasNoFormErrors();

    $event = AuditEvent::where('type', AuditType::Login)->sole();
    expect($event->actor_id)->toBe($moderator->id)
        ->and($event->actor_email)->toBe($moderator->email)
        ->and($event->outcome)->toBe('ok')
        ->and($event->ip_hash)->toBe(IpHash::make('127.0.0.1'));
});

it('senha errada grava login_failed só com o e-mail digitado, nunca a senha', function () {
    $moderator = Moderator::factory()->create(['password' => 'senha-certa-123']);

    Livewire::test(Login::class)
        ->fillForm(['email' => $moderator->email, 'password' => 'senha-errada-999'])
        ->call('authenticate');

    $event = AuditEvent::where('type', AuditType::LoginFailed)->sole();
    expect($event->actor_email)->toBe($moderator->email)
        ->and($event->actor_id)->toBeNull()
        ->and($event->outcome)->toBe('failed')
        ->and(json_encode($event->getAttributes()))->not->toContain('senha-errada-999')->not->toContain('senha-certa-123')
        ->and(AuditEvent::where('type', AuditType::Login)->count())->toBe(0);
});

it('e-mail desconhecido também grava a falha', function () {
    Livewire::test(Login::class)
        ->fillForm(['email' => 'ninguem@exemplo.com', 'password' => 'qualquer-coisa'])
        ->call('authenticate');

    expect(AuditEvent::where('type', AuditType::LoginFailed)->sole()->actor_email)->toBe('ninguem@exemplo.com');
});

it('sair grava logout com o autor', function () {
    $moderator = Moderator::factory()->create();
    $this->actingAs($moderator, 'moderator');

    Auth::guard('moderator')->logout();

    $event = AuditEvent::where('type', AuditType::Logout)->sole();
    expect($event->actor_id)->toBe($moderator->id)->and($event->ip_hash)->not->toBeNull();
});

it('eventos de outro guard não entram na trilha', function () {
    $user = User::factory()->create();

    Auth::guard('web')->login($user);
    Auth::guard('web')->logout();
    Auth::guard('web')->attempt(['email' => $user->email, 'password' => 'errada']);

    expect(AuditEvent::count())->toBe(0);
});

it('falha ao gravar o evento de acesso não derruba o login', function () {
    $moderator = Moderator::factory()->create(['password' => 'senha-certa-123']);
    DB::statement('DROP TABLE audit_events');

    Livewire::test(Login::class)
        ->fillForm(['email' => $moderator->email, 'password' => 'senha-certa-123'])
        ->call('authenticate')
        ->assertHasNoFormErrors();

    expect(Auth::guard('moderator')->check())->toBeTrue();
});
