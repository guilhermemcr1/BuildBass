<?php

use App\Models\Moderator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

const GOOD_PASSWORD = 'uma-senha-bem-longa-123';

it('cria o moderador com UUID e senha em hash, sem mostrar a senha', function () {
    $this->artisan('moderator:create', ['email' => 'Mod@Exemplo.com', '--name' => 'Moderadora'])
        ->expectsQuestion('Senha', GOOD_PASSWORD)
        ->expectsQuestion('Repita a senha', GOOD_PASSWORD)
        ->doesntExpectOutputToContain(GOOD_PASSWORD)
        ->assertSuccessful();

    $moderator = Moderator::query()->firstOrFail();

    expect($moderator->email)->toBe('mod@exemplo.com')
        ->and($moderator->name)->toBe('Moderadora')
        ->and($moderator->id)->toMatch('/^[0-9a-f-]{36}$/')
        ->and($moderator->password)->not->toBe(GOOD_PASSWORD)
        ->and(Hash::check(GOOD_PASSWORD, $moderator->password))->toBeTrue();
});

it('recusa e-mail repetido', function () {
    Moderator::factory()->create(['email' => 'mod@exemplo.com']);

    $this->artisan('moderator:create', ['email' => 'mod@exemplo.com'])->assertFailed();

    expect(Moderator::count())->toBe(1);
});

it('recusa senha curta e senhas diferentes', function () {
    $this->artisan('moderator:create', ['email' => 'a@exemplo.com'])
        ->expectsQuestion('Senha', 'curta')
        ->assertFailed();

    $this->artisan('moderator:create', ['email' => 'b@exemplo.com'])
        ->expectsQuestion('Senha', GOOD_PASSWORD)
        ->expectsQuestion('Repita a senha', GOOD_PASSWORD.'x')
        ->assertFailed();

    expect(Moderator::count())->toBe(0);
});

it('recusa e-mail inválido', function () {
    $this->artisan('moderator:create', ['email' => 'sem-arroba'])->assertFailed();
});

it('--reset troca a senha de quem existe e recusa quem não existe', function () {
    $moderator = Moderator::factory()->create(['email' => 'mod@exemplo.com']);

    $this->artisan('moderator:create', ['email' => 'mod@exemplo.com', '--reset' => true])
        ->expectsQuestion('Senha', GOOD_PASSWORD)
        ->expectsQuestion('Repita a senha', GOOD_PASSWORD)
        ->assertSuccessful();

    expect(Hash::check(GOOD_PASSWORD, $moderator->fresh()->password))->toBeTrue();

    $this->artisan('moderator:create', ['email' => 'outro@exemplo.com', '--reset' => true])->assertFailed();
});
