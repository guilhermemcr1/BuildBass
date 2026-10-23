<?php

namespace App\Filament\Schemas;

use App\Models\Driver;
use App\Support\DriverVariant;
use Closure;
use Filament\Forms\Components\TextInput;

/**
 * Campos de texto da identificação do driver, sem texto livre onde não faz sentido: a variante é a
 * impedância (só o número, o Ω é escrito pelo sistema), fabricante e modelo aceitam só caracteres
 * de nomes de produto e o fabricante sugere os já cadastrados para não nascer "triton" e "Triton".
 */
class IdentityFields
{
    /** Letras, números, espaço e a pontuação de nomes de produto (TR 620 12", O'Neil & Co., 6.5-A). */
    public const NAME_PATTERN = '/^[\p{L}\p{N} .,\-\/+()"\'″&#×]+$/u';

    public static function brand(): TextInput
    {
        $field = TextInput::make('brand')->label('Fabricante')->required()->maxLength(80)
            ->placeholder('Ex.: Triton')
            ->autocomplete(false)
            ->datalist(fn (): array => Driver::query()->select('brand')->distinct()->orderBy('brand')->limit(500)->pluck('brand')->all())
            ->regex(self::NAME_PATTERN)
            ->dehydrateStateUsing(fn (?string $state): string => self::squish($state))
            ->validationMessages([
                'required' => 'Informe o fabricante.',
                'max' => 'No máximo 80 caracteres.',
                'regex' => self::nameMessage(),
            ]);

        return FieldTip::on($field, 'Escolha da lista quando já existir, para manter a mesma grafia.');
    }

    public static function model(): TextInput
    {
        $field = TextInput::make('model')->label('Modelo')->required()->maxLength(80)
            ->placeholder('Ex.: TR 620 12"')
            ->autocomplete(false)
            ->regex(self::NAME_PATTERN)
            ->dehydrateStateUsing(fn (?string $state): string => self::squish($state))
            ->validationMessages([
                'required' => 'Informe o modelo.',
                'max' => 'No máximo 80 caracteres.',
                'regex' => self::nameMessage(),
            ]);

        return FieldTip::on($field, 'Como na ficha do fabricante. Sem a impedância: ela vai na variante.');
    }

    /** A variante: impedância em ohms. O campo guarda "4 Ω" a partir de "4". */
    public static function variant(?Closure $disabled = null): TextInput
    {
        $field = TextInput::make('variant')
            ->label('Variante · impedância')
            ->suffix(DriverVariant::SYMBOL)
            ->placeholder('Ex.: 4')
            ->inputMode('decimal')
            ->autocomplete(false)
            ->datalist(DriverVariant::COMMON)
            ->formatStateUsing(fn (?string $state): string => DriverVariant::forInput($state))
            ->dehydrateStateUsing(fn (?string $state): string => DriverVariant::format($state))
            ->rule(fn (): Closure => function (string $attribute, mixed $value, Closure $fail): void {
                if (trim((string) $value) !== '' && DriverVariant::parse((string) $value) === null) {
                    $fail('Informe só a impedância em ohms, de '.DriverVariant::MIN_OHM.' a '.DriverVariant::MAX_OHM.' (ex.: 4 ou 3.2). Sem texto nem o símbolo Ω.');
                }
            });

        FieldTip::on($field, 'Impedância da bobina, em ohms (Ω), de '.DriverVariant::MIN_OHM.' a '.DriverVariant::MAX_OHM.'. Digite só o número: 4 vira "4 Ω". Deixe vazio se o modelo tem uma versão só.');

        return $disabled === null ? $field : $field->disabled($disabled);
    }

    public static function source(): TextInput
    {
        $field = TextInput::make('source')->label('Fonte dos dados')->required()->minLength(3)->maxLength(255)
            ->placeholder('Ex.: Triton, ficha técnica TR 620 12", jul/2018')
            ->dehydrateStateUsing(fn (?string $state): string => self::squish($state))
            ->validationMessages([
                'required' => 'Informe de onde vêm os dados.',
                'min' => 'Descreva a fonte com pelo menos 3 caracteres.',
                'max' => 'No máximo 255 caracteres.',
            ]);

        return FieldTip::on($field, 'De onde vêm os números: ficha do fabricante, manual, medição própria.');
    }

    /** Espaços das pontas e repetidos saem; "  Triton   Audio " vira "Triton Audio". */
    public static function squish(?string $value): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', (string) $value));
    }

    private static function nameMessage(): string
    {
        return 'Use só letras, números, espaço e . , - / + ( ) " \' & #. Sem símbolos soltos nem emojis.';
    }
}
