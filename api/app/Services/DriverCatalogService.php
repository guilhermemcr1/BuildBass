<?php

namespace App\Services;

use App\Models\Driver;
use App\Support\SearchText;
use Illuminate\Support\Collection;

class DriverCatalogService
{
    public const LIMIT = 20;

    // Caractere de escape do LIKE: "\" muda de significado entre MySQL e SQLite, "!" não.
    private const ESCAPE = '!';

    /**
     * Cada palavra do termo precisa aparecer em "marca modelo variação", sem acento nem caixa.
     * Os filtros opcionais (marca exata, tipo e faixa de diâmetro, com o máximo exclusivo) se
     * somam ao termo. Busca uma linha a mais que o limite só para saber se há mais resultados.
     *
     * @param  array{brand?: ?string, type?: ?string, diameter_min_m?: mixed, diameter_max_m?: mixed}  $filters
     * @return array{drivers: Collection<int, Driver>, hasMore: bool}
     */
    public function search(?string $term, array $filters = []): array
    {
        $query = Driver::query();

        if (($filters['brand'] ?? null) !== null && $filters['brand'] !== '') {
            $query->where('brand', $filters['brand']);
        }

        if (($filters['type'] ?? null) !== null) {
            $query->where('type', $filters['type']);
        }

        if (($filters['diameter_min_m'] ?? null) !== null) {
            $query->where('nominal_diameter_m', '>=', (float) $filters['diameter_min_m']);
        }

        if (($filters['diameter_max_m'] ?? null) !== null) {
            $query->where('nominal_diameter_m', '<', (float) $filters['diameter_max_m']);
        }

        foreach (SearchText::words($term ?? '') as $word) {
            $query->whereRaw(
                'search_text LIKE ? ESCAPE \''.self::ESCAPE.'\'',
                ['%'.$this->escapeLike($word).'%'],
            );
        }

        $found = $query
            ->orderBy('brand')
            ->orderBy('model')
            ->orderBy('variant')
            ->orderBy('id')
            ->limit(self::LIMIT + 1)
            ->get();

        return [
            'drivers' => $found->take(self::LIMIT)->values(),
            'hasMore' => $found->count() > self::LIMIT,
        ];
    }

    /**
     * Marcas do catálogo, em ordem alfabética, para o filtro por marca.
     *
     * @return list<string>
     */
    public function brands(): array
    {
        $brands = Driver::query()
            ->distinct()
            ->orderBy('brand')
            ->get(['brand'])
            ->map(fn (Driver $driver): string => $driver->brand);

        return array_values($brands->all());
    }

    public function find(string $id): ?Driver
    {
        return Driver::query()->find($id);
    }

    private function escapeLike(string $word): string
    {
        return str_replace(
            [self::ESCAPE, '%', '_'],
            [self::ESCAPE.self::ESCAPE, self::ESCAPE.'%', self::ESCAPE.'_'],
            $word,
        );
    }
}
