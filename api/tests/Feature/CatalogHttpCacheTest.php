<?php

use App\Models\Driver;
use Database\Seeders\DriverSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('manda cache curto e ETag nas leituras do catálogo', function (string $uri) {
    $this->seed(DriverSeeder::class);

    $response = $this->getJson(str_replace('{id}', (string) Driver::first()->id, $uri))->assertOk();

    expect($response->headers->get('Cache-Control'))->toContain('public')->toContain('max-age=60');
    expect($response->headers->get('ETag'))->not->toBeNull();
})->with(['/api/drivers?q=ab', '/api/driver-brands', '/api/drivers/{id}']);

it('responde 304 quando o ETag ainda vale', function () {
    $this->seed(DriverSeeder::class);

    $etag = $this->getJson('/api/drivers?q=ab')->headers->get('ETag');

    $this->getJson('/api/drivers?q=ab', ['If-None-Match' => $etag])->assertStatus(304);
});

it('não deixa cachear erro nem o envio de driver', function () {
    $this->getJson('/api/drivers/00000000-0000-0000-0000-000000000000')
        ->assertNotFound()
        ->assertHeaderMissing('ETag');

    expect($this->postJson('/api/driver-submissions', [])->headers->get('Cache-Control'))
        ->not->toContain('max-age=60');
});
