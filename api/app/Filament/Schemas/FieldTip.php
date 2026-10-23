<?php

namespace App\Filament\Schemas;

use Filament\Forms\Components\Field;
use Filament\Support\Icons\Heroicon;

/**
 * Explicação do campo em um ícone de ajuda ao lado do rótulo (tooltip), em vez de texto fixo
 * embaixo: o formulário fica limpo e a descrição aparece só quando alguém quer ler.
 */
final class FieldTip
{
    /**
     * @template T of Field
     *
     * @param  T  $field
     * @return T
     */
    public static function on(Field $field, string $text): Field
    {
        return $field->hintIcon(Heroicon::OutlinedInformationCircle, tooltip: $text)->hintColor('gray');
    }
}
