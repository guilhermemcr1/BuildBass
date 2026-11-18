<?php

namespace App\Console\Commands;

use App\Services\DriverCatalogSync;
use Illuminate\Console\Command;

/**
 * Leva o catálogo inicial (database/seeders/data/drivers, com as fotos) para o banco e relata o que
 * mudou. `--dry-run` só mostra; `--prune` também apaga a carga inicial que saiu do catálogo. O que um
 * moderador cadastrou, aprovou ou corrigiu nunca é tocado.
 */
class SyncDriverCatalog extends Command
{
    protected $signature = 'drivers:sync-catalog
        {--dry-run : Só relata o que mudaria, sem gravar nada}
        {--prune : Apaga drivers de carga inicial que não estão mais no catálogo}';

    protected $description = 'Sincroniza o catálogo inicial de drivers (parâmetros e fotos) com o banco';

    public function handle(DriverCatalogSync $sync): int
    {
        $apply = ! $this->option('dry-run');
        $prune = (bool) $this->option('prune');
        $report = $sync->run($apply, $prune);

        $this->components->info($apply ? 'Catálogo sincronizado.' : 'Simulação: nada foi gravado.');

        $this->section('A criar', $report['created']);
        $this->section('A atualizar (campos que mudam)', array_map(
            fn (string $label, array $fields): string => "{$label}: ".implode(', ', $fields),
            array_keys($report['updated']),
            $report['updated'],
        ));
        $this->section('Mesmo driver com outra grafia (renomeado)', array_map(
            fn (string $old, string $new): string => "{$old} → {$new}",
            array_keys($report['renamed']),
            $report['renamed'],
        ));
        $this->section('Protegidos (moderador mexeu; não tocados)', $report['protected']);
        $this->section(
            $prune ? 'Fora do catálogo (apagados)' : 'Fora do catálogo (use --prune para apagar)',
            $report['stale'],
        );
        $this->section('Fotos a importar', $report['images']);
        $this->section('Fotos recusadas', array_map(
            fn (string $label, string $why): string => "{$label}: {$why}",
            array_keys($report['imageErrors']),
            $report['imageErrors'],
        ));
        $this->section('Fora do padrão (corrigir no painel)', array_map(
            fn (string $label, string $why): string => "{$label}: {$why}",
            array_keys($report['nonStandard']),
            $report['nonStandard'],
        ));

        $this->newLine();
        $this->line(sprintf(
            'Resumo: %d a criar, %d a atualizar, %d renomeados, %d sem mudança, %d protegidos, %d fora do catálogo, %d fotos.',
            count($report['created']), count($report['updated']), count($report['renamed']), $report['unchanged'],
            count($report['protected']), count($report['stale']), count($report['images']),
        ));

        if ($report['imagesSkipped'] > 0) {
            $this->components->warn("{$report['imagesSkipped']} fotos puladas: este PHP não grava WebP (GD sem imagewebp).");
        }

        return self::SUCCESS;
    }

    /** @param list<string> $lines */
    private function section(string $title, array $lines): void
    {
        if ($lines === []) {
            return;
        }

        $this->newLine();
        $this->line("<options=bold>{$title} (".count($lines).')</>');

        foreach (array_slice($lines, 0, 60) as $line) {
            $this->line("  • {$line}");
        }

        if (count($lines) > 60) {
            $this->line('  … e mais '.(count($lines) - 60));
        }
    }
}
