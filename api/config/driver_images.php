<?php

// Imagens de driver. O upload é decodificado, reduzido e regravado em
// WebP (o original não é guardado). Os limites protegem a memória do GD e o disco.
return [

    'disk' => 'public',
    'directory' => 'driver-images',

    // Por driver e por arquivo enviado (KB).
    'max_files' => 5,
    'max_kb' => 5120,

    // Recusados antes de decodificar: lado maior e megapixels.
    'max_side_px' => 8000,
    'max_megapixels' => 24,

    'mimes' => ['image/jpeg', 'image/png', 'image/webp'],

    // Lado maior da imagem ampliada e da miniatura, com a qualidade do WebP.
    'full_px' => 1280,
    'thumb_px' => 240,
    'full_quality' => 82,
    'thumb_quality' => 78,

];
