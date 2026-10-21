<?php

use App\Models\Driver;
use Database\Seeders\DriverSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('não tem rota de escrita no catálogo', function (string $method, string $uri) {
    $this->seed(DriverSeeder::class);
    $id = Driver::first()->id;
    $before = Driver::count();

    $this->json($method, str_replace('{id}', (string) $id, $uri), ['brand' => 'X'])
        ->assertStatus(405);

    expect(Driver::count())->toBe($before);
})->with([
    ['POST', '/api/drivers'],
    ['PUT', '/api/drivers'],
    ['PATCH', '/api/drivers/{id}'],
    ['PUT', '/api/drivers/{id}'],
    ['DELETE', '/api/drivers/{id}'],
    ['DELETE', '/api/drivers'],
]);

it('limita a 60 pedidos por minuto por IP e responde 429 com Retry-After', function () {
    $this->seed(DriverSeeder::class);

    foreach (range(1, 60) as $attempt) {
        $this->getJson('/api/drivers?q=triton')->assertOk();
    }

    $this->getJson('/api/drivers?q=triton')
        ->assertStatus(429)
        ->assertHeader('Retry-After');
    $this->getJson('/api/drivers/1')->assertStatus(429);
});
