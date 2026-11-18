# Progresso do catálogo inicial

Atualize ao terminar cada marca. Serve para retomar o trabalho sem depender do histórico de uma conversa.

## Feitas

| Arquivo | Drivers | Fonte | Observações |
|---|---|---|---|
| `bomber-subwoofers.json` | 59 | bomber.com.br (manuais PDF) | |
| `bomber-outros.json` | 46 | bomber.com.br (manuais PDF) | 12 sem `type` |
| `triton.json` | 58 | tritonaltofalantes.com.br | 32 sem `type` |
| `selenium.json` | 28 | jbl.com.br, support.jbl.com, jblpro.com | provavelmente incompleta, ver abaixo |
| `eros.json` | 67 | eros.com.br (manuais PDF, a maioria só imagem) | 18/11/2026 |
| `taramps.json` | 33 | taramps.com.br (manuais PDF + `produto-sitemap.xml`) | 18/11/2026 |
| `oversound.json` | 39 | oversound.com.br (data sheets PDF, só imagem) | 18/11/2026; inclui 3 descontinuados com ficha oficial |
| `hinor.json` | 5 | hinor.com.br (manuais EVO 1100 e SW-3K) | 18/11/2026; New City sem T/S |

## Fotos (18/11/2026)

260 modelos com foto (`images/<marca>/`, 33 MB, até 1280 px; transparentes em WebP, o resto em JPEG):
Bomber 78/80, Eros 67/67, Triton 57/57, Taramps 27/27, Oversound 28/39, Hinor 2/4, Selenium 1/24.
Todas do fabricante, menos o Selenium 12MG1000 (loja, 200×200).

- **Sem foto:** Bomber Atrack 5K 12" 2500W (página sem imagem) e MG Outdoor 8" 200W (download expirou, tentar de novo);
  Oversound 15G 400, 18.2-600, 18-800 ST, 8 Steel 150, 10 Steel 300, 450w10, 15/18 SUB 1000 XT (o site usa foto de outro
  modelo), 15-800, SUB 800, SUB 1000 (descontinuados); Hinor 15 EVO 1100 e 18 SW-3K (sem página); Selenium: jbl.com.br,
  support.jbl.com, jblpro.com e as lojas grandes bloqueiam leitura automática — precisa pegar as URLs à mão no navegador.
- **Foto da linha, não do tamanho exato** (o próprio site da Bomber repete a foto): Upgrade 350W/400W 10"/12", W-One,
  Carbon 500/550W, Upgrade 12" 375/500W, Bicho Papão 15" 400/600/2000W, Slim High Power 8". Marcado com `note` no levantamento.

## Pendentes e bloqueios

- **Selenium/JBL:** jbl.com.br devolve 403 a leitura automática. Não contornar (sem trocar User-Agent). Para completar, alguém precisa listar os modelos no navegador ou baixar os PDFs à mão.
- **Eros, PDF acima de 10 MB** (limite do WebFetch), não transcritos: E-412 MG, E-612 MG, E-10 New Vorax, E-8 New Vorax, E 410 XH Black, E-358 XH Black, E-412 XH Black, E-15 SDS 2.7K, E-18 SDS PRO.
- **Eros, sem manual na página:** E-1200 MB, E-15 Target Bass 3K, E-15 SDS 2.4K, E-18 SDS 2.7K Black, E-18 Target Bass 3.0K, E-12 Hammer 7K, E-12 650 MG, E-12 LC Black, E-12 Hammer 5.2K Black, E-12 MG 2.8K, E-12 Hammer 4.7K.
- **Eros, modelos que aparecem em manuais de linha mas não no catálogo do site:** E-15 SDS 2.4K, E-310/E-312 LC (variações), E-250 LC Black, E-1500 MB. Dá para incluir com o manual de linha como fonte.
- **Sem acesso:** SD Audio veio vazio no fetch; Bravox só tem catálogo PDF acima de 10 MB.

## Descartados (e por quê)

- **Eros E-15 Hammer 3.0K:** nenhuma impedância fecha o Qes.
- **Eros E-15 Target Bass 3.3K:** ficha sem Mms, não dá para saber se o T/S é de 4 ou 8 Ω.
- **Taramps New Dark 5K8:** Qes não fecha (Re 1,1 Ω num nominal de 2 Ω).
- **Taramps 18 SL 1K7 e 12 BASS 500:** manuais da 7Driver Audio, não Taramps.
- **Oversound 5 AR 240:** a ficha arredonda Qes 1,1 / Qms 5,5 / Qts 1,0 e o Qts não fecha.
- **Oversound 100w8:** ficha única "4/8 Ω" sem Mms nem BL. **INSANNO DUO:** sem ficha.
- **Hinor 15 EVO 1100 4 Ω:** Qts copiado do 12" na ficha, não fecha.
- Variantes de impedância derivadas de ficha única (só Re trocado): removidas, ver regra no README.
