# BassBuild API

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

## Envio de drivers e moderação (feature 006)

- `POST /api/driver-submissions` cria um envio **pendente** (5 por hora por IP, honeypot `website`,
  Turnstile). Contrato: `../specs/006-enviar-driver-moderacao/contracts/submission-api.md`.
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

Do IP do remetente só se guarda um hash (HMAC com a chave do app); o e-mail opcional é apagado
depois do aviso da decisão.
