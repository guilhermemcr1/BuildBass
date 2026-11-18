<?php

namespace Database\Seeders;

use App\Services\DriverCatalogSync;
use Illuminate\Database\Seeder;

// Catálogo inicial: um JSON por marca em data/drivers, transcrito das fichas técnicas públicas dos
// fabricantes (unidades da ficha, convertidas para SI), com as fotos de data/drivers/images. Nada vem
// do banco ou dos arquivos do BassBox. Idempotente, e só mexe em drivers de carga inicial: o que um
// moderador cadastrou, aprovou ou corrigiu no painel não é sobrescrito, e foto só entra em driver sem
// imagem. Para ver antes o que muda (e apagar o que saiu do catálogo): `php artisan drivers:sync-catalog`.
class DriverSeeder extends Seeder
{
    public function run(DriverCatalogSync $sync): void
    {
        $report = $sync->run(apply: true);

        foreach ($report['imageErrors'] as $label => $why) {
            $this->command?->warn("Foto recusada ({$why}): {$label}");
        }

        if ($report['imagesSkipped'] > 0) {
            $this->command?->warn("{$report['imagesSkipped']} fotos não importadas: este PHP não grava WebP (GD sem imagewebp).");
        }
    }
}
