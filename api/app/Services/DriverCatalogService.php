<?php

namespace App\Services;

use App\Http\Requests\SearchDriversRequest;
use App\Models\Driver;
use App\Support\SearchText;
use Illuminate\Support\Collection;

class DriverCatalogService
{
    public const LIMIT = 20;

    // Caractere de escape do LIKE: "\" muda de significado entre MySQL e SQLite, "!" não.
    private const ESCAPE = '!';

    // `search_text` sem a pontuação que `SearchText::compact` tira (REPLACE existe no MySQL e no SQLite).
    private const COMPACT_SQL = "REPLACE(REPLACE(REPLACE(REPLACE(search_text, ' ', ''), '-', ''), '.', ''), '/', '')";

    /**
     * Cada palavra do termo precisa aparecer em "marca modelo variação" (sem acento, caixa nem
     * pontuação) ou no tipo. Sem termo nem filtro, lista o catálogo em ordem alfabética.
     * `$offset` pula os resultados já mostrados ("Mostrar mais").
     * Os filtros opcionais (marca exata, tipo, faixa de diâmetro com o máximo exclusivo e faixas
     * de Fs, Qts e Vas) se somam ao termo. Busca uma linha a mais que o limite só para saber se há mais resultados.
     *
     * @param  array<string, mixed>  $filters
     * @return array{drivers: Collection<int, Driver>, hasMore: bool}
     */
    public function search(?string $term, array $filters = [], int $offset = 0): array
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

        // Faixas de Fs, Qts e Vas: mínimo e máximo inclusivos.
        foreach (SearchDriversRequest::PARAMETER_FILTERS as $key => $field) {
            if (($filters[$key] ?? null) !== null) {
                $query->where($field, str_contains($key, '_min') ? '>=' : '<=', (float) $filters[$key]);
            }
        }

        // Busca livre: cada palavra precisa aparecer no nome (com ou sem pontuação, então
        // "tsw3010" acha "TS-W3010") ou no tipo ("sub" acha os subwoofers).
        foreach (SearchText::words($term ?? '') as $word) {
            $like = '%'.$this->escapeLike($word).'%';
            $compact = SearchText::compact($word);

            $query->where(function ($match) use ($like, $compact): void {
                $match->whereRaw('search_text LIKE ? ESCAPE \''.self::ESCAPE.'\'', [$like])
                    ->orWhereRaw('type LIKE ? ESCAPE \''.self::ESCAPE.'\'', [$like]);

                if ($compact !== '') {
                    $match->orWhereRaw(
                        self::COMPACT_SQL.' LIKE ? ESCAPE \''.self::ESCAPE.'\'',
                        ['%'.$this->escapeLike($compact).'%'],
                    );
                }
            });
        }

        $found = $query
            ->orderBy('brand')
            ->orderBy('model')
            ->orderBy('variant')
            ->orderBy('id')
            ->offset($offset)
            ->limit(self::LIMIT + 1)
            ->get();

        return [
            'drivers' => $found->take(self::LIMIT)->values(),
            // Para no teto do offset: o próximo pedido seria recusado (SearchDriversRequest::MAX_OFFSET).
            'hasMore' => $found->count() > self::LIMIT && $offset + self::LIMIT <= SearchDriversRequest::MAX_OFFSET,
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

    /**
     * Driver do catálogo que colide com a identificação dada: mesmo "marca modelo variação"
     * normalizado ou a mesma tripla exata. `$ignoreId` deixa um driver em edição fora da conta.
     */
    public function findDuplicate(string $brand, string $model, string $variant, ?string $ignoreId = null): ?Driver
    {
        $key = SearchText::normalize("{$brand} {$model} {$variant}");

        return Driver::query()
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->where(fn ($query) => $query
                ->where('search_text', $key)
                ->orWhere(fn ($same) => $same
                    ->where('brand', $brand)
                    ->where('model', $model)
                    ->where('variant', $variant)))
            ->first();
    }

    public function existsDuplicate(string $brand, string $model, string $variant, ?string $ignoreId = null): bool
    {
        return $this->findDuplicate($brand, $model, $variant, $ignoreId) !== null;
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
