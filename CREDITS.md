# Créditos

O BuildBass existe graças ao trabalho de muita gente que publicou, de graça, a teoria e as ferramentas usadas aqui. Esta página reúne quem fez o projeto e em cima de quê ele foi construído.

> A tela **Sobre** do app (botão ⓘ na barra do topo) resume esta página. Se mudar uma, atualize a outra: os dados da autoria ficam em [`web/src/lib/credits.ts`](web/src/lib/credits.ts).

## Autoria

- **Guilherme G.**: idealização e desenvolvimento
  - GitHub: [@guilhermemcr1](https://github.com/guilhermemcr1)
  - Portfólio: [galarca.dev](https://galarca.dev)

## Agradecimentos

<!-- PLACEHOLDER: pessoas que testaram, deram feedback ou ensinaram acústica e marcenaria. Uma por linha, no formato "- **Nome**: o que fez". -->

_Em breve._

## Contribuidores

<!-- PLACEHOLDER: quem abrir PR aceito entra aqui. Pode virar lista automática depois (all-contributors). -->

_Seja o primeiro: veja [Contribuindo](README.md#-contribuindo)._

## Referências técnicas

Cada equação do motor de cálculo (`web/src/engine`) cita no código a fonte de onde veio:

- **A. N. Thiele**: _Loudspeakers in Vented Boxes_ (1961/1971) e a família de alinhamentos QB3, B4 e C4
- **R. H. Small**: artigos do JAES (1972–1973) sobre caixas seladas e dutadas e as relações Thiele-Small
- **D. B. Keele Jr.**: aproximações dos alinhamentos (1973)
- **W. M. Leach Jr.**: modelo de bobina com perdas (2002)
- **V. Dickason**: _Loudspeaker Design Cookbook_
- **L. L. Beranek**: _Acoustics_

<!-- PLACEHOLDER: normas, artigos, planilhas ou casos de fabricantes usados na suíte de regressão do motor. -->

## Dados do catálogo

- Os parâmetros Thiele-Small vêm das fichas técnicas públicas dos fabricantes. Marcas e modelos pertencem aos seus respectivos donos, e o BuildBass não tem vínculo com eles.
- Os drivers enviados pela comunidade passam por moderação antes de entrar no catálogo.

<!-- PLACEHOLDER: política de correção de dados ("achou um valor errado? abra uma issue") e link para a lista de colaboradores do catálogo. -->

## Software de terceiros

Cada projeto abaixo segue a sua própria licença.

| Front-end (`web/`) | Back-end (`api/`) |
|---|---|
| [React](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Vite](https://vite.dev) | [Laravel](https://laravel.com) · PHP |
| [Tailwind CSS](https://tailwindcss.com) · [React Aria Components](https://react-spectrum.adobe.com/react-aria/) | [Filament](https://filamentphp.com) |
| [Zustand](https://zustand.docs.pmnd.rs) · [Zundo](https://github.com/charkour/zundo) | [Pest](https://pestphp.com) · [Larastan](https://github.com/larastan/larastan) · [Pint](https://laravel.com/docs/pint) |
| [uPlot](https://github.com/leeoniya/uPlot) · [Zod](https://zod.dev) · [i18next](https://www.i18next.com) | [poppler-utils](https://poppler.freedesktop.org) · [OpenRouter](https://openrouter.ai) |
| [Vitest](https://vitest.dev) · [Playwright](https://playwright.dev) · [axe-core](https://github.com/dequelabs/axe-core) | [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) |

A lista completa e as versões estão em [`web/package.json`](web/package.json) e [`api/composer.json`](api/composer.json).

## Identidade visual

- Fontes: [Archivo](https://fonts.google.com/specimen/Archivo) e [IBM Plex Mono](https://github.com/IBM/plex), ambas sob a SIL Open Font License 1.1, distribuídas pelo [Fontsource](https://fontsource.org).
- Ícones: [Lucide](https://lucide.dev) (licença ISC).
- Logo: <!-- PLACEHOLDER: autor e licença do logo, se não for feito por você. -->

## Licença

O BuildBass é distribuído sob a licença [MIT](LICENSE).
