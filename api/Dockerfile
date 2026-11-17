# API Laravel do BuildBass (imagem de produção).
# Imagem PHP 8.4 + nginx (serversideup) já pronta para Laravel, com suporte ao autorun de produção.
FROM serversideup/php:8.4-fpm-nginx

USER root

# gd (com WebP) converte as imagens dos drivers, intl é exigida pelo Filament,
# poppler-utils (pdftotext/pdfinfo) lê as fichas técnicas em PDF.
RUN install-php-extensions intl gd pdo_mysql \
    && apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Limites de upload: PDF de 10 MB e imagens de 5 MB cada (mesmos valores do serve-local.sh).
ENV PHP_UPLOAD_MAX_FILE_SIZE=12M \
    PHP_POST_MAX_SIZE=40M \
    PHP_MEMORY_LIMIT=512M

# OPcache vem desligado na imagem; em produção o código é imutável (nada de checar timestamps).
ENV PHP_OPCACHE_ENABLE=1 \
    PHP_OPCACHE_VALIDATE_TIMESTAMPS=0

# Na subida: cacheia config/rotas/views e cria o storage:link. Migrations ficam por sua conta
# (README: "você roda; nada aqui migra o banco"). Para migrar a cada deploy, defina
# AUTORUN_LARAVEL_MIGRATION=true nas variáveis de ambiente do deploy.
ENV AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_MIGRATION=false \
    AUTORUN_LARAVEL_STORAGE_LINK=true

WORKDIR /var/www/html
USER www-data

# Dependências numa camada própria: só reinstala quando composer.json/lock mudam, não a cada commit.
COPY --chown=www-data:www-data composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --no-progress

COPY --chown=www-data:www-data . .
RUN composer dump-autoload --no-dev --optimize --no-interaction
