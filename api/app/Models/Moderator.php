<?php

namespace App\Models;

use Database\Factories\ModeratorFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * Moderador do painel de envios. Toda conta existente pode entrar no painel: contas são criadas
 * só pelo mantenedor (php artisan moderator:create).
 *
 * @property string $id
 * @property string $name
 * @property string $email
 * @property string $password
 */
class Moderator extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<ModeratorFactory> */
    use HasFactory;

    use HasUuids;

    protected $fillable = ['name', 'email', 'password'];

    protected $hidden = ['password', 'remember_token'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return true;
    }
}
