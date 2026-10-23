<?php

namespace App\Filament\Schemas;

use App\Models\Driver;
use App\Support\DriverDerivation;
use Closure;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\Fieldset;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Utilities\Set;

/**
 * Campos dos parâmetros T/S na unidade das fichas (gravados em SI), com a unidade no sufixo e as faixas físicas de `Driver::RANGES`.
 * Compartilhado pela revisão de envios e pela gestão de drivers: um lugar só para as faixas.
 */
class DriverParameterFields
{
    /** Rótulos dos parâmetros, na ordem em que o moderador confere. A unidade vai no sufixo do campo. */
    public const LABELS = [
        'fs_hz' => 'Fs',
        'qts' => 'Qts',
        'vas_m3' => 'Vas',
        'qes' => 'Qes',
        'qms' => 'Qms',
        're_ohm' => 'Re',
        'le_h' => 'Le',
        'xmax_m' => 'Xmax',
        'sd_m2' => 'Sd',
        'pe_w' => 'Pe',
        'bl_tm' => 'BL',
        'mms_kg' => 'Mms',
        'vd_m3' => 'Vd',
        'nominal_diameter_m' => 'Diâmetro nominal',
    ];

    /**
     * Unidade de cada parâmetro: [símbolo, nome por extenso]. Qts, Qes e Qms são adimensionais
     * (ficam de fora).
     */
    public const UNITS = [
        'fs_hz' => ['Hz', 'hertz'],
        'vas_m3' => ['L', 'litros'],
        're_ohm' => ['Ω', 'ohms'],
        'le_h' => ['mH', 'milihenries'],
        'xmax_m' => ['mm', 'milímetros'],
        'sd_m2' => ['cm²', 'centímetros quadrados'],
        'pe_w' => ['W', 'watts'],
        'bl_tm' => ['T·m', 'tesla-metro'],
        'mms_kg' => ['g', 'gramas'],
        'vd_m3' => ['cm³', 'centímetros cúbicos'],
        'nominal_diameter_m' => ['mm', 'milímetros'],
    ];

    /**
     * Quanto vale 1 unidade do campo em SI. O painel mostra e recebe nas unidades das fichas
     * técnicas (litros, milímetros, mH…); o banco, a API e a bancada seguem em SI. Os parâmetros que
     * já são SI (Hz, Ω, W, T·m e os adimensionais) ficam de fora.
     */
    public const FACTORS = [
        'vas_m3' => 0.001,
        'le_h' => 0.001,
        'xmax_m' => 0.001,
        'sd_m2' => 0.0001,
        'mms_kg' => 0.001,
        'vd_m3' => 0.000001,
        'nominal_diameter_m' => 0.001,
    ];

    /** Exemplo típico de cada parâmetro (vai no placeholder). */
    public const EXAMPLES = [
        'fs_hz' => '40',
        'qts' => '0.4',
        'vas_m3' => '80',
        'qes' => '0.45',
        'qms' => '4.5',
        're_ohm' => '3.2',
        'le_h' => '1.5',
        'xmax_m' => '10',
        'sd_m2' => '300',
        'pe_w' => '300',
        'bl_tm' => '12',
        'mms_kg' => '80',
        'vd_m3' => '300',
        'nominal_diameter_m' => '254',
    ];

    /** Ajuda curta de cada parâmetro, para quem cadastra sem a ficha na cabeça. */
    public const HELP = [
        'fs_hz' => 'Frequência de ressonância.',
        'qts' => 'Fator de qualidade total.',
        'vas_m3' => 'Volume de ar equivalente à suspensão.',
        'qes' => 'Fator de qualidade elétrico.',
        'qms' => 'Fator de qualidade mecânico.',
        're_ohm' => 'Resistência da bobina em corrente contínua.',
        'le_h' => 'Indutância da bobina.',
        'xmax_m' => 'Excursão linear de um lado só (não o pico a pico).',
        'sd_m2' => 'Área efetiva do cone.',
        'pe_w' => 'Potência nominal RMS suportada, em watts (não é a massa móvel).',
        'bl_tm' => 'Fator de força do motor.',
        'mms_kg' => 'Massa móvel, em gramas (não é a potência).',
        'vd_m3' => 'Volume deslocado (Sd × Xmax).',
        'nominal_diameter_m' => 'Tamanho comercial (10" = 254 mm; 12" = 304.8 mm).',
    ];

    /**
     * Como os parâmetros se agrupam no formulário: nome do bloco => chaves. Todos os blocos usam a
     * mesma grade de 4 colunas, para os campos terem sempre a mesma largura.
     *
     * @var array<string, list<string>>
     */
    public const GROUPS = [
        'Obrigatórios' => ['fs_hz', 'qts', 'vas_m3'],
        'Elétricos' => ['qes', 're_ohm', 'le_h', 'bl_tm'],
        'Mecânicos' => ['qms', 'mms_kg', 'xmax_m', 'sd_m2'],
        'Potência, volume e tamanho' => ['pe_w', 'vd_m3', 'nominal_diameter_m'],
    ];

    /**
     * Os parâmetros em blocos com legenda (obrigatórios primeiro), na largura que cada bloco pede.
     *
     * @return list<Component>
     */
    public static function groups(?Closure $disabled = null): array
    {
        $fields = collect(self::make($disabled))->keyBy(fn (TextInput $field): string => $field->getName());

        $groups = [];

        foreach (self::GROUPS as $label => $keys) {
            $groups[] = Fieldset::make($label)
                ->columns(['default' => 1, 'sm' => 2, 'xl' => 4])
                ->schema(array_map(fn (string $key): TextInput => $fields[$key], $keys));
        }

        // Quais campos estão com valor calculado (e não digitado); não vai para o banco.
        $groups[] = Hidden::make('auto_keys')->default([])->dehydrated(false);

        return $groups;
    }

    /** O campo `$edited` foi mexido: vira "digitado" e os calculados são refeitos a partir dele. */
    private static function recalculate(string $edited, Get $get, Set $set): void
    {
        $data = ['auto_keys' => array_values(array_diff((array) ($get('auto_keys') ?? []), [$edited]))];

        foreach (DriverDerivation::KEYS as $key) {
            $data[$key] = $get($key);
        }

        $result = DriverDerivation::apply($data);

        foreach (DriverDerivation::KEYS as $key) {
            if ($key !== $edited && $result[$key] !== $data[$key]) {
                $set($key, $result[$key]);
            }
        }

        $set('auto_keys', $result['auto_keys']);
    }

    /** O valor em SI do banco, na unidade que o campo mostra (0.00389 H vira 3.89 mH). */
    public static function toDisplay(string $key, float $si, int $significant = 7): float
    {
        return RangedNumberInput::clean($si / (self::FACTORS[$key] ?? 1.0), $significant);
    }

    /**
     * @return list<TextInput>
     */
    public static function make(?Closure $disabled = null): array
    {
        $fields = [];

        foreach (self::LABELS as $key => $label) {
            $field = RangedNumberInput::make(
                $key,
                $label,
                Driver::RANGES[$key],
                self::EXAMPLES[$key],
                self::HELP[$key],
                in_array($key, Driver::REQUIRED_PARAMETERS, true),
                $label,
                self::UNITS[$key][0] ?? null,
                self::UNITS[$key][1] ?? null,
                self::FACTORS[$key] ?? 1.0,
            );

            if (in_array($key, DriverDerivation::KEYS, true)) {
                // Ao sair do campo, o que dá para calcular dos outros entra sozinho.
                $field->live(onBlur: true)->afterStateUpdated(fn (Get $get, Set $set) => self::recalculate($key, $get, $set));
            }

            if ($disabled !== null) {
                $field->disabled($disabled);
            }

            $fields[] = $field;
        }

        return $fields;
    }
}
