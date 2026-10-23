<?php

namespace App\Filament\Schemas;

use Filament\Forms\Components\TextInput;

/**
 * Campo numérico com faixa física: exemplo no placeholder, faixa legível na ajuda e mensagens de
 * erro que dizem o que digitar (sem notação científica, como "1.0E-6"). Um lugar só para o
 * comportamento dos campos numéricos do painel.
 */
class RangedNumberInput
{
    /**
     * @param  array{0: float|int, 1: float|int}  $range  [mínimo, máximo], em SI
     * @param  float  $factor  Quanto vale 1 unidade do campo em SI (1 mH = 0.001 H): o campo mostra e
     *                         recebe na unidade das fichas, mas o banco continua em SI
     * @param  string  $name  Como o campo é citado nas mensagens de erro
     */
    public static function make(
        string $key,
        string $label,
        array $range,
        string $example,
        ?string $help = null,
        bool $required = false,
        ?string $name = null,
        ?string $unit = null,
        ?string $unitName = null,
        float $factor = 1.0,
    ): TextInput {
        // A faixa, o exemplo e as mensagens falam a mesma unidade do campo.
        $min = self::clean($range[0] / $factor);
        $max = self::clean($range[1] / $factor);
        $span = self::plain($min).' a '.self::plain($max).($unit === null ? '' : " {$unit}");
        // O símbolo vai escrito no campo (sufixo) e descrito na ajuda: "Hz (hertz)".
        $unitNote = $unit === null
            ? 'Adimensional, sem unidade.'
            : "Unidade: {$unit}".($unitName === null ? '' : " ({$unitName})").'.';

        $field = TextInput::make($key)
            ->label($label)
            ->numeric()
            ->step('any')
            ->inputMode('decimal')
            ->autocomplete(false)
            ->minValue($min)
            ->maxValue($max)
            ->required($required)
            ->formatStateUsing(fn (mixed $state): mixed => is_numeric($state) ? self::clean((float) $state / $factor) : $state)
            ->dehydrateStateUsing(fn (mixed $state): mixed => is_numeric($state) ? self::clean((float) $state * $factor, 9) : null)
            ->placeholder("Ex.: {$example}")
            ->suffix($unit)
            ->validationAttribute($name ?? $label)
            ->validationMessages([
                'numeric' => 'Use só números, com ponto nos decimais (ex.: '.$example.').',
                'min' => "Valor abaixo do mínimo. Informe entre {$span}.",
                'max' => "Valor acima do máximo. Informe entre {$span}.",
                'required' => 'Este parâmetro é obrigatório.',
            ]);

        return FieldTip::on($field, trim(($help === null ? '' : "{$help} ")."{$unitNote} Faixa: {$span}."));
    }

    /**
     * Arredonda para algumas casas significativas, tirando o resto de ponto flutuante de contas
     * como 9 × 0.001 (0.009000000000000001).
     */
    public static function clean(float $value, int $significant = 7): float
    {
        if ($value === 0.0) {
            return 0.0;
        }

        return round($value, max(0, $significant - 1 - (int) floor(log10(abs($value)))));
    }

    /** Número sem notação científica e sem zeros à direita (1.0E-6 vira 0.000001). */
    public static function plain(float|int $value): string
    {
        $text = rtrim(rtrim(number_format((float) $value, 9, '.', ''), '0'), '.');

        return $text === '' ? '0' : $text;
    }
}
