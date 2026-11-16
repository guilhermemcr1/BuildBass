# BuildBass API

API JSON em Laravel 13 (catálogo de drivers e envio de drivers para moderação). Sem Inertia; o
front é a SPA em `../web`.

## Rodar

```bash
composer install
cp .env.example .env && php artisan key:generate   # depois ajuste o MySQL no .env
php artisan migrate                                  # você roda; nada aqui migra o banco
php artisan db:seed --class=DriverSeeder             # catálogo inicial
php artisan serve
```

Testes: `vendor/bin/pest` (SQLite em memória), `vendor/bin/pint --test`,
`vendor/bin/phpstan analyse --memory-limit=1G`.

## Envio de drivers e moderação

- `POST /api/driver-submissions` cria um envio **pendente** (5 por hora por IP, honeypot `website`,
  Turnstile).
- Painel de moderação (Filament) em `/moderation`, só para moderadores. Crie o primeiro:

  ```bash
  php artisan moderator:create voce@exemplo.com --name="Seu Nome"   # --reset redefine a senha
  ```

- Envios fictícios para ver o painel (só local): `php artisan db:seed --class=DriverSubmissionSeeder`.
- Migrations novas: `moderators` e `driver_submissions` (PK UUID).

| Variável | Local | Produção |
|---|---|---|
| `TURNSTILE_ENABLED` | `false` | `true` |
| `TURNSTILE_SECRET` | vazio | segredo do Cloudflare |
| `MAIL_MAILER` | `log` | SMTP/serviço real (aviso da decisão ao remetente) |
| `FRONTEND_URL` | origem(ns) da SPA, separadas por vírgula | domínio do front |

Do IP do remetente só se guarda um hash (HMAC com a chave do app); o e-mail de contato (obrigatório
no envio) é apagado depois do aviso da decisão.

## Leitura de manual por IA

`POST /api/driver-submissions/extract` recebe o PDF de uma ficha técnica, extrai o texto com o
poppler e consulta o OpenRouter para **sugerir** os campos do formulário de envio. Não grava o
PDF, o texto nem a resposta da IA.

Requisitos de deploy:

- `poppler-utils` instalado (`pdftotext` e `pdfinfo`); caminhos em `PDFTOTEXT_BIN`/`PDFINFO_BIN`.
- PHP com `upload_max_filesize` e `post_max_size` de pelo menos 12M (o padrão, 2M, barra o PDF).
- `CACHE_STORE=database` ou `redis` em produção: o limite por hora e o teto diário vivem no cache.
- Uma conta no OpenRouter com limite de gasto, como segunda barreira além do teto diário.

| Variável | Padrão | Função |
|---|---|---|
| `MANUAL_EXTRACTION_ENABLED` | `false` | liga o recurso |
| `OPENROUTER_API_KEY` | vazio | chave do provedor |
| `OPENROUTER_MODEL` | vazio | id do modelo (com saída estruturada); sem ele o recurso fica indisponível |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | |
| `MANUAL_EXTRACTION_HOURLY_LIMIT` | `3` | análises por IP por hora |
| `MANUAL_EXTRACTION_DAILY_CAP` | `200` | teto diário global de análises |

Os limites valem em qualquer ambiente. Falha do provedor ou PDF ilegível contam no limite por hora
mas não no teto diário; anti-robô reprovado e arquivo inválido não consomem nenhuma cota.
