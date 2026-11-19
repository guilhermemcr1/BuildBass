<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

// Pedido de sugestão de caixa por IA. Os parâmetros vêm em SI (como o front guarda) e só os três
// indispensáveis (Fs, Qts, Vas) são obrigatórios; o objetivo é escolhido de listas fechadas, sem
// texto livre, para não abrir espaço a abuso do prompt.
class StoreBoxSuggestionRequest extends FormRequest
{
    public const USAGES = ['car', 'home', 'pro'];

    public const PRIORITIES = ['deep', 'tight', 'loud'];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'locale' => ['required', 'in:pt-BR,en'],
            'driver' => ['required', 'array'],
            'driver.fs_hz' => ['required', 'numeric', 'between:1,20000'],
            'driver.qts' => ['required', 'numeric', 'between:0.05,10'],
            'driver.vas_m3' => ['required', 'numeric', 'between:0.000001,10'],
            'driver.qes' => ['nullable', 'numeric', 'between:0.05,10'],
            'driver.re_ohm' => ['nullable', 'numeric', 'between:0.1,100'],
            'driver.xmax_m' => ['nullable', 'numeric', 'between:0,0.1'],
            'driver.sd_m2' => ['nullable', 'numeric', 'between:0.0001,1'],
            'driver.pe_w' => ['nullable', 'numeric', 'between:1,100000'],
            'driver.vd_m3' => ['nullable', 'numeric', 'between:0,0.1'],
            'drivers_count' => ['required', 'integer', 'between:1,8'],
            'usage' => ['required', 'in:'.implode(',', self::USAGES)],
            'priority' => ['required', 'in:'.implode(',', self::PRIORITIES)],
            'max_volume_m3' => ['nullable', 'numeric', 'between:0.001,2'],
            'classic' => ['nullable', 'array'],
            'classic.type' => ['required_with:classic', 'in:closed,vented'],
            'classic.vb_m3' => ['required_with:classic', 'numeric', 'between:0.0001,20'],
            'classic.fb_hz' => ['nullable', 'numeric', 'between:1,500'],
            'classic.alignment' => ['nullable', 'string', 'max:20'],
        ];
    }

    /**
     * O que vai para a IA, em unidades de projeto (L, mm, cm², Hz), com os tipos permitidos.
     *
     * @return array<string, mixed>
     */
    public function forAi(): array
    {
        $driver = $this->validated('driver');
        $round = fn (?float $value, int $digits = 3): ?float => $value === null ? null : round($value, $digits);
        $get = fn (string $key): ?float => isset($driver[$key]) ? (float) $driver[$key] : null;
        $classic = $this->validated('classic');
        $max = $this->validated('max_volume_m3');

        return array_filter([
            'locale' => $this->validated('locale'),
            'allowed_types' => ['closed', 'vented'],
            'usage' => $this->validated('usage'),
            'priority' => $this->validated('priority'),
            'drivers_count' => (int) $this->validated('drivers_count'),
            'max_volume_liters' => $max === null ? null : $round((float) $max * 1000, 1),
            'driver' => array_filter([
                'fs_hz' => $round($get('fs_hz'), 2),
                'qts' => $round($get('qts')),
                'qes' => $round($get('qes')),
                'vas_liters' => $round(($get('vas_m3') ?? 0) * 1000, 2),
                're_ohm' => $round($get('re_ohm'), 2),
                'xmax_mm' => $get('xmax_m') === null ? null : $round($get('xmax_m') * 1000, 2),
                'sd_cm2' => $get('sd_m2') === null ? null : $round($get('sd_m2') * 10000, 1),
                'pe_w' => $round($get('pe_w'), 0),
                'vd_liters' => $get('vd_m3') === null ? null : $round($get('vd_m3') * 1000, 3),
            ], fn ($value) => $value !== null),
            'classic_alignment' => $classic === null ? null : array_filter([
                'type' => $classic['type'],
                'name' => $classic['alignment'] ?? null,
                'vb_liters' => $round((float) $classic['vb_m3'] * 1000, 2),
                'fb_hz' => isset($classic['fb_hz']) ? $round((float) $classic['fb_hz'], 2) : null,
            ], fn ($value) => $value !== null),
        ], fn ($value) => $value !== null);
    }
}
