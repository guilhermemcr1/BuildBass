<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
  <img alt="BuildBass" src=".github/assets/logo-light.svg" width="440">
</picture>

<p><strong>Projete, simule e corte a sua caixa acústica direto no navegador.</strong><br>
Parâmetros Thiele-Small entram, curvas de resposta e um plano de corte pronto para a marcenaria saem.</p>

<p>
  <a href="LICENSE"><img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-b8f53d?labelColor=121212"></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white&labelColor=121212">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white&labelColor=121212">
  <img alt="Laravel 13" src="https://img.shields.io/badge/Laravel-13-ff2d20?logo=laravel&logoColor=white&labelColor=121212">
  <img alt="Idiomas" src="https://img.shields.io/badge/idiomas-pt--BR%20%7C%20en-b8f53d?labelColor=121212">
</p>

<p>
  <a href="https://buildbass.galarca.dev/"><img alt="Testar online" src="https://img.shields.io/badge/%E2%96%B6%20testar%20online-buildbass.galarca.dev-b8f53d?style=for-the-badge&labelColor=121212"></a>
</p>

<p>
  <a href="#-recursos">Recursos</a> ·
  <a href="#-como-funciona">Como funciona</a> ·
  <a href="#-começando">Começando</a> ·
  <a href="#-testes-e-qualidade">Testes</a> ·
  <a href="#-o-motor-de-cálculo">Motor de cálculo</a> ·
  <a href="#-contribuindo">Contribuindo</a> ·
  <a href="#-créditos">Créditos</a>
</p>

<picture>
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/screenshot-light.png">
  <img alt="Bancada do BuildBass com a curva de resposta de um subwoofer de 12 polegadas em caixa dutada" src=".github/assets/screenshot-dark.png" width="100%">
</picture>

</div>

## ✨ Recursos

### 🧙 Assistente passo a passo

Na primeira visita, um assistente guia o projeto em três passos, editando o mesmo projeto da bancada:

1. **Alto-falante:** abre direto no catálogo. Se o seu não estiver lá, dá para anexar o manual em PDF ou colar o texto da ficha e deixar a IA preencher, ou digitar os valores. Fs, Qts e Vas já bastam para seguir.
2. **Caixa:** poucas perguntas (tipo, quantidade, tamanho, sintonia e potência), com a sugestão clássica, o desenho da caixa e os números mudando na hora.
3. **Conferência:** tudo o que foi preenchido, o gráfico de resposta e o pedido de uma segunda opinião à IA.

<table>
  <tr>
    <td width="50%"><img alt="Assistente no passo do alto-falante: busca no catálogo e, ao lado, as opções de manual em PDF, texto colado e digitação" src=".github/assets/screenshot-assistant-catalog.png"></td>
    <td width="50%"><img alt="Assistente no passo da caixa: perguntas à esquerda e prévia da caixa com volume, F3 e comprimento do duto à direita" src=".github/assets/screenshot-assistant-box.png"></td>
  </tr>
  <tr>
    <td align="center"><sub>1. Alto-falante: catálogo primeiro, alternativas sempre à vista</sub></td>
    <td align="center"><sub>2. Caixa: perguntas simples com a prévia ao lado</sub></td>
  </tr>
  <tr>
    <td width="50%"><img alt="Assistente na conferência: resumo do alto-falante e da caixa com botões de editar e pedido de sugestão à IA" src=".github/assets/screenshot-assistant-review.png"></td>
    <td width="50%" align="center"><img alt="Assistente no celular, em tela cheia, com o catálogo e as alternativas empilhadas" src=".github/assets/screenshot-assistant-mobile.png" width="60%"></td>
  </tr>
  <tr>
    <td align="center"><sub>3. Conferência antes de cortar a madeira</sub></td>
    <td align="center"><sub>No celular, em tela cheia</sub></td>
  </tr>
</table>

### 📄 Leitura de manual por IA

O alto-falante não está no catálogo? Anexe o PDF da ficha técnica ou cole o texto da loja e a IA preenche os campos vazios, já convertidos para o SI. Antes de qualquer coisa ir para a IA, um **filtro** no navegador e outro no servidor deixam passar só as linhas com parâmetros (sem links, e-mails nem propaganda), com limite de caracteres, de linhas e de páginas. O arquivo não fica guardado, e valores fora da faixa ou incoerentes entre si voltam marcados para conferência.

<table>
  <tr>
    <td width="50%"><img alt="Manual em PDF anexado no assistente, com a IA lendo o arquivo" src=".github/assets/screenshot-assistant-pdf.png"></td>
    <td width="50%"><img alt="Dados do alto-falante preenchidos pela IA a partir do manual, com Fs, Qts e Vas conferidos" src=".github/assets/screenshot-assistant-pdf-result.png"></td>
  </tr>
  <tr>
    <td align="center"><sub>Anexe o PDF e a IA lê a ficha técnica</sub></td>
    <td align="center"><sub>Os campos vazios voltam preenchidos para conferir</sub></td>
  </tr>
  <tr>
    <td width="50%"><img alt="Texto colado com parâmetros e propaganda, com o aviso de quantas linhas vão para a IA e quantas são ignoradas" src=".github/assets/screenshot-assistant-text.png"></td>
    <td width="50%"><img alt="Envio de alto-falante ao catálogo com os campos preenchidos a partir do manual em PDF" src=".github/assets/screenshot-submit-filled.png"></td>
  </tr>
  <tr>
    <td align="center"><sub>Texto colado: só as linhas com parâmetros são enviadas</sub></td>
    <td align="center"><sub>O mesmo leitor preenche o envio ao catálogo</sub></td>
  </tr>
</table>

### 🔊 Simulação acústica

- **Quatro tipos de caixa:** selada, dutada, bandpass de 4ª ordem e bandpass de 6ª ordem.
- **Cinco gráficos:** resposta em frequência, excursão do cone, impedância, atraso de grupo e velocidade do ar no duto. Até 3 projetos podem ser sobrepostos no mesmo gráfico para comparação.
- **Resultados na hora:** F3, comprimento do duto, velocidade máxima no duto, potência no Xmax, sensibilidade, eficiência, volume líquido e 1ª ressonância de tubo.
- **Sugestão de caixa:** alinhamentos Butterworth (selada) e QB3, B4 ou C4 (dutada) calculados para as perdas reais da caixa.
- **Modelo realista:** perdas por vazamento (QL 5, 7, 10 ou 15), material de absorção, correção de ponta do duto (flangeada, livre, slot na parede ou personalizada) e bobina com perdas pelo modelo de Leach.
- **Vários drivers** em série ou em paralelo, sinal em watts ou volts, e radiação em meio espaço ou espaço livre.
- **Dutos** redondos, retangulares ou triangulares, um ou mais por caixa.
- **Verificação de consistência:** os parâmetros Thiele-Small são conferidos entre si, e cada campo mostra se o valor está OK, merece atenção ou tem erro.

### 🪚 Plano de corte

- **Peças com medidas** internas e externas, para qualquer tipo de caixa, já descontando o volume do driver, do duto e dos reforços.
- **Proporções** prontas (razão áurea, Louden e outras) ou personalizadas.
- **Encaixe nas chapas** a partir do seu estoque de chapas inteiras e sobras, com dois modos: **serra** (corte guilhotina) e **CNC/tupia** (corte livre, MaxRects).
- **Recortes** do alto-falante e do duto posicionados automaticamente ou à mão, digitando a medida ou arrastando no desenho.
- **Conferência de volume** por câmara, **vista 3D** da caixa montada, exportação em **CSV** e uma **folha de impressão** só com o plano.

<table>
  <tr>
    <td width="50%"><img alt="Plano de corte com peças, recortes do alto-falante e do duto, e corte total" src=".github/assets/screenshot-cutplan.png"></td>
    <td width="50%"><img alt="Vista 3D da caixa montada, com cotas de largura, altura e profundidade, recorte do alto-falante e duto" src=".github/assets/screenshot-box-3d.png"></td>
  </tr>
  <tr>
    <td align="center"><sub>Plano de corte com peças, recortes e conferência de volume</sub></td>
    <td align="center"><sub>Caixa em 3D, cotada, para girar com o mouse ou o teclado</sub></td>
  </tr>
</table>

### 📚 Catálogo de drivers

- **Busca** por fabricante ou modelo. Ao escolher um driver, os parâmetros são copiados para o projeto, que continua editável.
- **Envio de drivers** para a comunidade, com moderação antes de entrar no catálogo e proteção anti-robô (Cloudflare Turnstile).
- **Preenchimento por manual:** anexe o PDF da ficha técnica e a IA sugere os campos (veja [Leitura de manual por IA](#-leitura-de-manual-por-ia)).
- **Meus alto-falantes:** guarde os seus drivers no navegador e exporte ou importe a lista.

### 🛡️ Painel de moderação

- Fila de envios com aprovação, rejeição com motivo e aviso por e-mail ao remetente.
- Cadastro de drivers com imagens (convertidas para WebP).
- Trilha de auditoria somente leitura e painel de uso com envios, aprovações e consumo da IA.

### 🧰 Bancada

- **Projetos em abas** (até 3), salvos automaticamente no navegador, com desfazer e refazer.
- Arquivos **`.buildbass.json`** para abrir e exportar projetos, compatíveis com todas as versões anteriores.
- **Exportação do gráfico** em PNG ou PDF, com legenda configurável (picos, F3/F10, dados da caixa e alertas).
- **Modo Normal e modo Pro**: só o essencial ou todos os campos.
- **Tutorial guiado** com destaque animado em cada painel.
- **pt-BR e inglês**, unidades métricas ou imperiais por campo, tema claro, escuro ou do sistema, e atalhos de teclado.
- **Funciona offline:** sem conexão, só o catálogo fica indisponível.

## 🧭 Como funciona

```mermaid
flowchart LR
    subgraph Navegador["🌐 Navegador (web/)"]
        UI["Bancada<br/>React + Tailwind"] --> Engine["Motor de cálculo<br/>TypeScript puro"]
        UI --> Cut["Plano de corte"]
        UI <--> Store[("Projetos<br/>localStorage")]
    end
    subgraph Servidor["🖥️ API (api/)"]
        API["Laravel 13<br/>API JSON"] --> DB[("MySQL")]
        Panel["Painel Filament<br/>/moderation"] --> DB
        API --> AI["OpenRouter<br/>(leitura de PDF e texto)"]
    end
    UI -- "catálogo e envios" --> API
```

Todo o cálculo acontece **no navegador**. O motor acústico é um módulo TypeScript puro, sem dependências de interface, então simular, comparar e gerar o plano de corte não depende de servidor nem de conta. A API serve só o que precisa ser compartilhado: o catálogo de drivers, os envios da comunidade e o painel de moderação.

| Pasta | O que tem |
|---|---|
| [`web/`](web) | SPA em React 19 + TypeScript: bancada, motor (`src/engine`), plano de corte (`src/cutplan`), i18n e testes |
| [`api/`](api) | API em Laravel 13: catálogo, envios, leitura de manual por IA e painel de moderação em Filament |
| [`.github/`](.github) | Dependabot e imagens deste README |

### Stack

| Front-end | Back-end |
|---|---|
| React 19 · TypeScript · Vite+ | PHP 8.3+ · Laravel 13 |
| Tailwind CSS 4 · React Aria Components | Filament 5 (painel de moderação) |
| Zustand + Zundo (estado e desfazer) | MySQL (SQLite em memória nos testes) |
| uPlot (gráficos) · Zod (validação) | Pest · Larastan · Pint |
| i18next · Vitest · Playwright + axe | poppler-utils + OpenRouter (leitura de PDF) |

## 🚀 Começando

### Pré-requisitos

- **Node.js 22+** para o front
- **PHP 8.3+** com Composer e a extensão GD (com WebP) para a API
- **MySQL 8** (ou compatível) para a API
- Opcional: `poppler-utils` para a leitura de manuais em PDF

### Só o simulador (sem back-end)

O simulador funciona sozinho. Sem a API, só a busca no catálogo e o envio de drivers ficam desativados.

```bash
cd web
npm ci
cp .env.example .env
npm run dev          # http://localhost:5173
```

### Com a API

```bash
cd api
composer setup                                  # instala, cria o .env e gera a chave
# ajuste DB_* no .env para um banco MySQL vazio
php artisan migrate
php artisan db:seed --class=DriverSeeder        # catálogo inicial
php artisan storage:link                        # imagens dos drivers
php artisan moderator:create voce@exemplo.com --name="Seu Nome"
./serve-local.sh                                # http://localhost:8000 com limites de upload maiores
```

O painel de moderação fica em `http://localhost:8000/moderation`. Os detalhes da API, as variáveis de ambiente e os requisitos de produção estão no [README da API](api/README.md).

### Variáveis de ambiente

| Onde | Variável | Para quê |
|---|---|---|
| `web/.env` | `VITE_API_URL` | Endereço da API (padrão `http://localhost:8000`) |
| `web/.env` | `VITE_TURNSTILE_SITE_KEY` | Chave pública do Turnstile (vazia = sem captcha) |
| `api/.env` | `FRONTEND_URL` | Origens do front liberadas no CORS |
| `api/.env` | `TURNSTILE_ENABLED`, `TURNSTILE_SECRET` | Anti-robô nos envios |
| `api/.env` | `MANUAL_EXTRACTION_ENABLED`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Leitura de manual por IA |

## 🧪 Testes e qualidade

```bash
# Front-end
cd web
npm run check         # formatação e lint
npm run types:check   # TypeScript
npm run test          # testes unitários e de componentes (Vitest)
npm run test:e2e      # ponta a ponta com Playwright, incluindo acessibilidade (axe)
npm run screenshots   # regrava as imagens deste README em .github/assets (API simulada)

# API
cd api
composer test         # Pint, Larastan e Pest (SQLite em memória)
```


## 📐 O motor de cálculo

O motor em [`web/src/engine`](web/src/engine) resolve o circuito equivalente eletro-mecano-acústico do alto-falante e da caixa em cada frequência. Cada equação cita no código a fonte pública de onde veio:

- **A. N. Thiele**: *Loudspeakers in Vented Boxes* (1961/1971) e a família de alinhamentos QB3, B4 e C4
- **R. H. Small**: os artigos do JAES (1972–1973) sobre caixas seladas e dutadas e as relações Thiele-Small
- **D. B. Keele Jr.**: aproximações dos alinhamentos (1973)
- **W. M. Leach Jr.**: modelo de bobina com perdas (2002)
- **V. Dickason**: *Loudspeaker Design Cookbook*
- **L. L. Beranek**: *Acoustics*

Os valores padrão seguem as convenções mais usadas no mercado (correção de ponta 0,732·D, QL 7, c ≈ 343 m/s). Uma suíte de regressão compara o motor com casos publicados por fabricantes e com tabelas de alinhamento, e as fórmulas fechadas são conferidas por implementações independentes nos testes.

## 🤝 Contribuindo

Contribuições são bem-vindas, sejam elas correções, novos tipos de caixa, traduções ou drivers para o catálogo.

1. Faça um fork e crie uma branch a partir da `main` (`feature/minha-ideia` ou `fix/o-que-corrige`).
2. Rode os testes e as verificações dos dois projetos antes de abrir o PR.
3. Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat(engine): …`, `fix(web): …`).
4. Equações novas no motor precisam citar a fonte e vir acompanhadas de testes contra um caso conhecido.

Encontrou um resultado estranho? Abra uma [issue](https://github.com/guilhermemcr1/BuildBass/issues) com o arquivo `.buildbass.json` do projeto e o valor que você esperava.

## 🙌 Créditos

Idealizado e desenvolvido por **Guilherme G.**

[![GitHub](https://img.shields.io/badge/GitHub-guilhermemcr1-121212?logo=github&logoColor=white&labelColor=121212)](https://github.com/guilhermemcr1)
[![Portfólio](https://img.shields.io/badge/portf%C3%B3lio-galarca.dev-b8f53d?labelColor=121212)](https://galarca.dev)

O BuildBass se apoia na teoria publicada por Thiele, Small, Keele, Leach, Dickason e Beranek e em software livre de terceiros. A lista completa de referências, dados, bibliotecas, fontes e agradecimentos está em [CREDITS.md](CREDITS.md). No app, o menu **Ajuda** da barra do topo abre a tela **Sobre**.

Usou o BuildBass em um trabalho? O GitHub gera a citação pelo botão **Cite this repository**, a partir do [CITATION.cff](CITATION.cff).

## 📄 Licença

Distribuído sob a licença [MIT](LICENSE).

<div align="center">
<sub>Feito com 🎶 e muito MDF.</sub>
</div>
