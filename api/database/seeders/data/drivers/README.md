# Catálogo inicial de drivers

Um arquivo `<marca>.json` por marca. O `DriverSeeder` lê todos, converte para SI e grava com
`origin = initial_load`. Rode `vendor/bin/pest --filter=DriverCatalog` depois de editar: o teste
barra faixa fora do app, duplicata e números que não fecham entre si (erro de digitação ou de unidade).

```json
{
  "brand": "Bomber",
  "drivers": [
    {
      "model": "Bicho Papão 12\" 800W",
      "variant": "4 Ω",
      "type": "subwoofer",
      "diameter_in": 12,
      "fs_hz": 37,
      "qts": 0.5,
      "qes": 0.52,
      "qms": 11.17,
      "vas_l": 31.5,
      "re_ohm": 3.16,
      "le_mh": 2.65,
      "xmax_mm": 13,
      "sd_cm2": 453,
      "pe_w": 800,
      "bl_tm": 15.34,
      "mms_g": 164.75,
      "source": "Bomber, manual 3.27.347 Rev. 00 (27/03/23), cód. 1.23.107, SW12BPF800-4",
      "source_url": "https://bomber.com.br/wp-content/uploads/2023/03/3.27.347-1.23.107-Manual-SW-12-BPF-800W-4-ohms.pdf"
    }
  ]
}
```

## Regras

- **Unidades da ficha**, sem converter: pol, L, mm, cm², mH, g, cm³. Fs em Hz, Re em Ω, BL em T·m, Pe em W.
- **Obrigatórios:** `model`, `source`, `fs_hz`, `qts`, `vas_l`. O resto só entra se a ficha trouxer. **Nunca invente nem estime um valor:** campo ausente fica de fora.
- `model`: nome comercial + diâmetro + potência (`Bicho Papão 12" 800W`), até 80 caracteres. `variant`: impedância (`4 Ω`; bobina dupla é `4+4 Ω`, duas bobinas iguais), até 40. A chave `marca + model + variant` é única.
- `type`: `subwoofer`, `woofer`, `midbass`, `midrange` ou `fullrange`. Só se a ficha ou a linha do fabricante deixar claro.
- **Bobina dupla:** os parâmetros (Re, Le, BL, Qes) são os da ficha com as **duas bobinas em série**, que é como os fabricantes medem (Re ≈ 2× a impedância de uma bobina; o teste confere). O app calcula a ligação em paralelo sozinho. Se a ficha trouxer só a medição em paralelo, deixe o driver de fora.
- `pe_w`: a potência **RMS/contínua** da ficha, não a "música" ou "pico".
- `vd_cm3`: só se a ficha trouxer; sem ele o seeder usa Sd × Xmax.
- `source`: fabricante, documento, revisão/data e código do produto (até 255 caracteres). `source_url` é opcional e só documenta de onde veio.
- Só fichas e manuais públicos **do fabricante**. Nada de agregadores nem bancos de outros softwares.
- **Ficha "4 ou 8 Ohms" com um só conjunto T/S** (só a Re muda): o conjunto foi medido numa impedância só. Entra apenas a variante cujo Qes fecha com Fs·Mms·Re/BL² (o teste confere); as outras ficam de fora. Sem Mms ou BL para decidir, o modelo fica de fora. Quando a marca publica um conjunto por impedância e todos fecham, entram todos.
- Valor impossível na ficha (ex.: "0,85 Sq.m" de Sd num 15") fica de fora, sem corrigir.

## Fotos

- `image`: caminho da foto relativo a `images/` (`bomber/bicho-papao-12-800w.jpg`), JPEG, PNG ou WebP, lado menor ≥ 200 px, até 5 MB. Uma foto por modelo; as impedâncias do mesmo modelo apontam para o mesmo arquivo.
- `image_source`: URL `https://` da página onde a foto aparece. `image_origin`: `fabricante` (site oficial, preferido) ou `loja` (só quando o fabricante não tem foto do modelo).
- A foto precisa ser **do modelo** (mesma linha, diâmetro e potência). Na dúvida, sem foto.
- O seeder converte para WebP (ampliada + miniatura, como o upload do painel) e grava só em driver **sem imagem**: a galeria montada por um moderador nunca é trocada. Precisa de PHP com GD/WebP; sem isso, avisa e pula as fotos.

Progresso por marca, fontes bloqueadas e descartes: [STATUS.md](STATUS.md).
