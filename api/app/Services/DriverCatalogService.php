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
     * Busca uma linha a mais que o limite só para saber se há mais resultados.
     *
     * @return array{drivers: Collection<int, Driver>, hasMore: bool}
     */
    public function search(string $term): array
    {
        $query = Driver::query();

        foreach (SearchText::words($term) as $word) {
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
