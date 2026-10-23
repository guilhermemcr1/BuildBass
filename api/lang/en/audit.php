<?php

// O painel de moderação é só em pt-BR (constituição, princípio VI); este arquivo evita chave solta
// quando a locale da API é en.
return require __DIR__.'/../pt_BR/audit.php';
