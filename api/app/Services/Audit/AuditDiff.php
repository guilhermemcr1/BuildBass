<?php

namespace App\Services\Audit;

/** Diferença campo a campo entre dois estados, para os eventos de edição. */
class AuditDiff
{
    /**
     * Só os campos de `$fields` que mudaram, como `[campo => [antes, depois]]`. `variant` vazia e
     * nula são a mesma coisa; números comparam como float.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  list<string>  $fields
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public static function between(array $before, array $after, array $fields): array
    {
        $changes = [];

        foreach ($fields as $field) {
            $old = self::normalize($before[$field] ?? null);
            $new = self::normalize($after[$field] ?? null);

            if ($old !== $new) {
                $changes[$field] = [$old, $new];
            }
        }

        return $changes;
    }

    private static function normalize(mixed $value): mixed
    {
        if ($value === '' || $value === null) {
            return null;
        }

        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }

        return $value;
    }
}
