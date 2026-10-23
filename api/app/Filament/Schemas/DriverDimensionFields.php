<?php

namespace App\Filament\Schemas;

use App\Models\Driver;
use Filament\Forms\Components\Select;
use Filament\Schemas\Components\Fieldset;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\View;

/**
 * Medidas físicas do driver (formato, pistão e cotas A–G, em metros): o esquema em corte à esquerda
 * e os campos à direita. Focar um campo acende a cota no desenho. As faixas são as de
 * `Driver::DIMENSION_RANGES`; a cota D só existe no formato retangular, como na bancada.
 */
class DriverDimensionFields
{
    public const SHAPE_LABELS = ['round' => 'Redondo', 'square' => 'Quadrado', 'rect' => 'Retangular'];

    public const PISTON_LABELS = ['cone' => 'Cone', 'dome' => 'Domo', 'flat' => 'Plano'];

    /**
     * Cada cota: letra do esquema, nome, onde medir e um valor de exemplo (alto-falante de 10").
     *
     * @var array<string, array{letter: string, title: string, text: string, example: string}>
     */
    public const DIMENSIONS = [
        'drv_a_m' => [
            'letter' => 'A', 'title' => 'Aro externo', 'example' => '0.27',
            'text' => 'Diâmetro de fora a fora do aro (a borda que apoia no painel). Em formato retangular, o lado maior.',
        ],
        'drv_b_m' => [
            'letter' => 'B', 'title' => 'Diâmetro do cone', 'example' => '0.22',
            'text' => 'Largura do cone, de borda a borda da suspensão.',
        ],
        'cutout_m' => [
            'letter' => 'C', 'title' => 'Recorte', 'example' => '0.24',
            'text' => 'Diâmetro do furo a abrir no painel frontal. Vem na ficha do fabricante.',
        ],
        'drv_d_m' => [
            'letter' => 'D', 'title' => 'Segundo lado', 'example' => '0.18',
            'text' => 'Lado menor do aro retangular (o maior é a cota A).',
        ],
        'drv_e_m' => [
            'letter' => 'E', 'title' => 'Profundidade do ímã', 'example' => '0.06',
            'text' => 'Quanto o ímã e o cesto avançam para dentro da caixa, a partir da traseira do aro.',
        ],
        'drv_f_m' => [
            'letter' => 'F', 'title' => 'Espessura do aro', 'example' => '0.01',
            'text' => 'Espessura da borda do aro que fica sobre o painel.',
        ],
        'drv_g_m' => [
            'letter' => 'G', 'title' => 'Profundidade total', 'example' => '0.12',
            'text' => 'Da frente do aro até a traseira do ímã: o espaço que o driver ocupa dentro da caixa.',
        ],
    ];

    /**
     * @return list<Grid>
     */
    public static function make(): array
    {
        $fields = [
            FieldTip::on(Select::make('drv_shape')->label('Formato')
                ->options(self::SHAPE_LABELS)
                ->placeholder('Não informado')
                ->native(false)
                ->live(), 'Quadrado e retangular mudam a vista frontal do desenho.'),
            FieldTip::on(Select::make('drv_piston')->label('Tipo de pistão')
                ->options(self::PISTON_LABELS)
                ->placeholder('Não informado')
                ->native(false)
                ->live(), 'Forma da parte móvel: cone, domo ou plano.'),
        ];

        foreach (self::DIMENSIONS as $key => $info) {
            $field = RangedNumberInput::make(
                $key,
                "{$info['letter']} · {$info['title']}",
                Driver::DIMENSION_RANGES[$key],
                $info['example'],
                $info['text'],
                false,
                "cota {$info['letter']} ({$info['title']})",
                'm',
                'metros',
            )->extraInputAttributes([
                'x-on:focus' => "\$dispatch('dim-focus', { key: '{$key}' })",
                'x-on:blur' => "\$dispatch('dim-focus', { key: null })",
            ]);

            if ($key === 'drv_d_m') {
                $field->visible(fn (Get $get): bool => $get('drv_shape') === 'rect');
            }

            $fields[] = $field;
        }

        $choices = array_slice($fields, 0, 2);
        $measures = array_slice($fields, 2);

        return [
            Grid::make(['default' => 1, 'xl' => 12])->schema([
                View::make('filament.driver-dimensions-drawing')
                    ->viewData(fn (Get $get): array => [
                        'shape' => $get('drv_shape') ?: 'round',
                        'piston' => $get('drv_piston') ?: 'cone',
                        'dimensions' => self::DIMENSIONS,
                    ])
                    ->columnSpan(['default' => 1, 'xl' => 7]),
                Grid::make(1)
                    ->schema([
                        Grid::make(['default' => 1, 'sm' => 2])->schema($choices),
                        Fieldset::make('Cotas, em metros')
                            ->columns(['default' => 1, 'sm' => 2])
                            ->schema($measures),
                    ])
                    ->columnSpan(['default' => 1, 'xl' => 5]),
            ]),
        ];
    }
}
