<?php

use App\Models\Driver;

// A fixture é escrita pelo teste do front (web/src/lib/submission/schema.test.ts) a partir de
// PARAMETERS. Aqui ela precisa bater com Driver::RANGES.
it('tem as mesmas faixas do front', function () {
    $fixture = json_decode((string) file_get_contents(__DIR__.'/../Fixtures/submission-ranges.json'), true);
    $ranges = Driver::RANGES;

    ksort($fixture);
    ksort($ranges);

    expect(array_keys($fixture))->toBe(array_keys($ranges));

    foreach ($ranges as $key => [$min, $max]) {
        expect((float) $fixture[$key][0])->toBe((float) $min, "mínimo de {$key}")
            ->and((float) $fixture[$key][1])->toBe((float) $max, "máximo de {$key}");
    }
});
