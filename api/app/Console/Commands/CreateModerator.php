<?php

namespace App\Console\Commands;

use App\Models\Moderator;
use Illuminate\Console\Command;

class CreateModerator extends Command
{
    protected $signature = 'moderator:create
        {email : E-mail de login do moderador}
        {--name= : Nome exibido no painel}
        {--reset : Troca a senha de um moderador que já existe}';

    protected $description = 'Cria um moderador do painel de envios (ou troca a senha com --reset)';

    private const MIN_PASSWORD_LENGTH = 12;

    public function handle(): int
    {
        $email = mb_strtolower($this->text($this->argument('email')));

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || mb_strlen($email) > 254) {
            $this->error('Informe um e-mail válido.');

            return self::FAILURE;
        }

        $existing = Moderator::query()->where('email', $email)->first();
        $reset = (bool) $this->option('reset');

        if ($existing !== null && ! $reset) {
            $this->error('Já existe um moderador com este e-mail. Use --reset para trocar a senha.');

            return self::FAILURE;
        }

        if ($existing === null && $reset) {
            $this->error('Não existe moderador com este e-mail.');

            return self::FAILURE;
        }

        $password = $this->askPassword();

        if ($password === null) {
            return self::FAILURE;
        }

        if ($existing !== null) {
            $existing->update(['password' => $password]);
            $this->info("Senha de {$email} trocada.");

            return self::SUCCESS;
        }

        $name = $this->text($this->option('name'));

        Moderator::create([
            'name' => $name === '' ? $email : mb_substr($name, 0, 100),
            'email' => $email,
            'password' => $password,
        ]);
        $this->info("Moderador {$email} criado. O painel fica em /moderation.");

        return self::SUCCESS;
    }

    private function askPassword(): ?string
    {
        $password = $this->text($this->secret('Senha'), trim: false);

        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $this->error('A senha precisa ter pelo menos '.self::MIN_PASSWORD_LENGTH.' caracteres.');

            return null;
        }

        if ($password !== $this->text($this->secret('Repita a senha'), trim: false)) {
            $this->error('As senhas não conferem.');

            return null;
        }

        return $password;
    }

    /**
     * Argumentos, opções e respostas chegam como mixed; só texto vale.
     */
    private function text(mixed $value, bool $trim = true): string
    {
        if (! is_string($value)) {
            return '';
        }

        return $trim ? trim($value) : $value;
    }
}
