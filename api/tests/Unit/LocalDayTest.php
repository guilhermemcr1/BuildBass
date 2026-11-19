<?php

use App\Support\LocalDay;

it('a chave do dia segue o fuso local, não o UTC', function () {
    config(['app.display_timezone' => 'America/Sao_Paulo']);
    $this->travelTo('2026-10-23 02:30:00'); // 23:30 do dia 22 em Brasília

    expect(LocalDay::key())->toBe('2026-10-22')
        ->and(LocalDay::startUtc()->toDateTimeString())->toBe('2026-10-22 03:00:00')
        ->and(LocalDay::end()->utc()->toDateTimeString())->toBe('2026-10-23 02:59:59');
});
