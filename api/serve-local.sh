#!/usr/bin/env bash
# Servidor local com limites de upload suficientes para PDF (10 MB) e imagens (5 MB cada).
# `php artisan serve` não repassa -d ao processo filho, por isso o servidor embutido é chamado direto.
cd "$(dirname "$0")/public" && exec php -d upload_max_filesize=12M -d post_max_size=40M -d memory_limit=512M \
    -S localhost:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
