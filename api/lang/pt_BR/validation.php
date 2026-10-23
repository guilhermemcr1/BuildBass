<?php

// Mensagens de validação do painel e da API em português. Chaves que não estão aqui caem no inglês
// do framework; o painel força pt_BR (ver SetPanelLocale).
return [
    'accepted' => 'O campo :attribute deve ser aceito.',
    'array' => 'O campo :attribute deve ser uma lista.',
    'between' => [
        'array' => 'O campo :attribute deve ter entre :min e :max itens.',
        'file' => 'O arquivo de :attribute deve ter entre :min e :max kilobytes.',
        'numeric' => 'O campo :attribute deve estar entre :min e :max.',
        'string' => 'O campo :attribute deve ter entre :min e :max caracteres.',
    ],
    'boolean' => 'O campo :attribute deve ser verdadeiro ou falso.',
    'date' => 'O campo :attribute deve ser uma data válida.',
    'decimal' => 'O campo :attribute deve ter :decimal casas decimais.',
    'email' => 'O campo :attribute deve ser um e-mail válido.',
    'enum' => 'O valor escolhido em :attribute é inválido.',
    'exists' => 'O valor escolhido em :attribute é inválido.',
    'file' => 'O campo :attribute deve ser um arquivo.',
    'filled' => 'O campo :attribute precisa de um valor.',
    'gt' => [
        'numeric' => 'O campo :attribute deve ser maior que :value.',
        'string' => 'O campo :attribute deve ter mais de :value caracteres.',
    ],
    'gte' => [
        'numeric' => 'O campo :attribute deve ser maior ou igual a :value.',
        'string' => 'O campo :attribute deve ter :value caracteres ou mais.',
    ],
    'image' => 'O arquivo de :attribute deve ser uma imagem.',
    'in' => 'O valor escolhido em :attribute é inválido.',
    'integer' => 'O campo :attribute deve ser um número inteiro.',
    'json' => 'O campo :attribute deve ser um JSON válido.',
    'lt' => [
        'numeric' => 'O campo :attribute deve ser menor que :value.',
        'string' => 'O campo :attribute deve ter menos de :value caracteres.',
    ],
    'lte' => [
        'numeric' => 'O campo :attribute deve ser menor ou igual a :value.',
        'string' => 'O campo :attribute deve ter no máximo :value caracteres.',
    ],
    'max' => [
        'array' => 'O campo :attribute deve ter no máximo :max itens.',
        'file' => 'O arquivo de :attribute deve ter no máximo :max kilobytes.',
        'numeric' => 'O campo :attribute deve ser no máximo :max.',
        'string' => 'O campo :attribute deve ter no máximo :max caracteres.',
    ],
    'mimes' => 'O arquivo de :attribute deve ser do tipo: :values.',
    'mimetypes' => 'O arquivo de :attribute deve ser do tipo: :values.',
    'min' => [
        'array' => 'O campo :attribute deve ter pelo menos :min itens.',
        'file' => 'O arquivo de :attribute deve ter pelo menos :min kilobytes.',
        'numeric' => 'O campo :attribute deve ser no mínimo :min.',
        'string' => 'O campo :attribute deve ter pelo menos :min caracteres.',
    ],
    'not_in' => 'O valor escolhido em :attribute é inválido.',
    'numeric' => 'O campo :attribute deve ser um número.',
    'password' => [
        'letters' => 'A :attribute deve ter pelo menos uma letra.',
        'mixed' => 'A :attribute deve ter pelo menos uma letra maiúscula e uma minúscula.',
        'numbers' => 'A :attribute deve ter pelo menos um número.',
        'symbols' => 'A :attribute deve ter pelo menos um símbolo.',
        'uncompromised' => 'Essa :attribute apareceu em um vazamento de dados. Escolha outra.',
    ],
    'present' => 'O campo :attribute deve estar presente.',
    'regex' => 'O formato de :attribute é inválido.',
    'required' => 'Preencha o campo :attribute.',
    'required_if' => 'Preencha o campo :attribute quando :other for :value.',
    'required_with' => 'Preencha o campo :attribute quando :values estiver preenchido.',
    'same' => 'Os campos :attribute e :other devem ser iguais.',
    'size' => [
        'array' => 'O campo :attribute deve ter :size itens.',
        'file' => 'O arquivo de :attribute deve ter :size kilobytes.',
        'numeric' => 'O campo :attribute deve ser :size.',
        'string' => 'O campo :attribute deve ter :size caracteres.',
    ],
    'string' => 'O campo :attribute deve ser um texto.',
    'unique' => 'Já existe um registro com este valor em :attribute.',
    'uploaded' => 'Não foi possível enviar o arquivo de :attribute.',
    'url' => 'O campo :attribute deve ser uma URL válida.',
    'uuid' => 'O campo :attribute deve ser um UUID válido.',

    'custom' => [],

    'attributes' => [
        'email' => 'e-mail',
        'password' => 'senha',
        'name' => 'nome',
    ],
];
