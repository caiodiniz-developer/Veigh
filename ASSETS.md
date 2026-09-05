# Assets necessários para o redesign

Checklist do que falta em `public/` para destravar as seções fotográficas.
Marque conforme for subindo.

## Regras de nome (importante)

- **Tudo minúsculo, sem espaço e sem acento.** Servidor de produção em Linux é
  case-sensitive: `Video-sessao1.mp4` já deu 404 uma vez por causa do V maiúsculo.
- Separador é hífen: `show-lollapalooza-01.jpg`, não `show lolla (1).jpg`.

## Formatos

| tipo | formato | tamanho | observação |
| --- | --- | --- | --- |
| foto full-bleed (ocupa a viewport) | JPG ou WebP | lado maior 2400px | qualidade 80-85, não precisa PNG |
| foto de galeria / timeline | JPG ou WebP | lado maior 1600px | |
| capa de álbum | JPG | quadrada, mín. 1400×1400 | |
| logo / selo de imprensa | SVG ou PNG com alpha | — | SVG se tiver |
| vídeo ambiente (toca em loop) | MP4 H.264 | 1080p | pode mandar como está |
| vídeo scrubado pelo scroll | MP4 H.264 | 1080p | **me avise**: preciso re-encodar all-intra, senão trava (ver README-video.md) |

---

## O que falta, por seção

### Capas dos álbuns — destrava 4 seções de uma vez
São o item de maior alcance: a transição entre eras, o player, o background
reativo e as duas seções de era dependem delas.

- [ ] `capa-dos-predios.jpg`
- [ ] `capa-dos-predios-deluxe.jpg`
- [ ] `capa-eu-venci-o-mundo.jpg`

### Era 01 — Dos Prédios
Estética urbana, concreto, Itapevi, SP crua.

- [ ] 3 a 5 fotos → `era01-01.jpg` … `era01-05.jpg`
- [ ] uma delas de preferência vertical, para atravessar a viewport

### Era 02 — Dos Prédios Deluxe
Mesma pessoa, mundo maior: menos rua, mais ascensão.

- [ ] 2 a 3 fotos → `era02-01.jpg` …

### Era da Ascensão
- [ ] 3 a 4 fotos ou pequenos vídeos → `ascensao-01.jpg` / `ascensao-01.mp4`
- [ ] se tiver foto com os artistas das collabs, melhor ainda

### Galeria — Memory Wall
- [ ] 12 a 20 fotos → `galeria-01.jpg` … `galeria-20.jpg`
- [ ] bastidores, backstage, estúdio, rua — quanto mais variado, melhor a parede
- [ ] se souber data/legenda de alguma, me mande a lista junto (aparece no hover)

### Clipes
Para cada clipe:
- [ ] thumbnail → `clipe-vidachique.jpg`
- [ ] preview de 3-5s sem áudio → `clipe-vidachique-preview.mp4`
- [ ] ou, se preferir, só o link do YouTube que eu trato o embed

### Shows
- [ ] 4 a 8 fotos → `show-01.jpg` … (palco, multidão, luz)
- [ ] vídeo de show, se houver → `show-01.mp4` (tem prioridade sobre foto)

### Imprensa / Conquistas
- [ ] capa ou print da Forbes Under 30 → `imprensa-forbes.jpg`
- [ ] logos dos veículos → `logo-forbes.svg`, `logo-billboard.svg` …
- [ ] se tiver manchetes específicas que queira usar, me mande o texto

---

## O que já está resolvido

- `hero.mp4` / `hero-scrub.mp4` — intro EVOM
- `video-sessao1.mp4` — seção "A História" e o encerramento do site
- `e.png` `v.png` `o.png` `m.png` — os pingentes

## O que eu construo sem depender de nada disso

Manifesto tipográfico com masking de vídeo, timeline da carreira, números
monumentais, player/coverflow das 16 faixas, "Do Brasil pro Mundo", tipografia
cinética, cursor, grain, transições entre seções e o encerramento.

## Áudio

Não tenho previews das faixas. Se você tiver direito de uso de trechos curtos,
suba como `preview-<faixa>.m4a` (15-30s). Sem isso o player fica com a
interação visual completa, só sem som — que é o combinado.

---

# Prévias de áudio (pendente)

O player das 16 faixas está pronto para tocar áudio de verdade, mas o projeto
não tem nenhum arquivo de som. Assim que estes existirem, o motor de
reprodução entra em cima deles.

## Onde e como

Pasta: **`public/previews/`** (criar).

| formato | duração | bitrate |
| --- | --- | --- |
| MP3 (ou OGG) | 15 a 30s por faixa | 128 kbps mono já basta para prévia |

Não precisa ser a faixa inteira — o refrão ou a melhor passagem de cada uma.
Trechos curtos mantêm o load leve e são o que a interface espera.

**Os arquivos precisam ser seus ou licenciados.** Não vou buscar prévias de
faixas comerciais para preencher.

## Nomes exatos

Estes nomes são derivados dos títulos da tracklist. Usar exatamente assim
significa zero edição de código depois — o player encontra sozinho.

```
public/previews/
  reunioes-comigo-mesmo.mp3
  hiperfoco.mp3
  ausencia.mp3
  artista-generico.mp3
  taylor.mp3
  belieber.mp3
  talvez-voce-precise-de-mim.mp3
  dono-da-verdade.mp3
  monaco-freestyle.mp3
  filho-da-promessa.mp3
  perdoe-me-por-ser-um-astro.mp3
  sangue-do-cordeiro.mp3
  visoes.mp3
  indiretas-com-a-voz.mp3
  influencie.mp3
  amor-ficticio.mp3
```

Não precisa mandar as 16 de uma vez. O player trata faixa sem prévia
individualmente: quem tiver arquivo toca, quem não tiver segue com a
interação visual.

## O que entra quando os arquivos chegarem

- play automático da faixa central quando a seção entra em viewport, com
  fade-in de volume (~800ms)
- crossfade de 300ms ao trocar de faixa (arrasto, seta ou clique na capa)
- fade-out ao sair da seção, para não competir com o vídeo dos clipes
- waveform e barra de tempo sincronizadas com `currentTime` / `duration` reais
- mute e volume no player
- uma fonte de som por vez em toda a página: o vídeo dos clipes e o player
  se desligam mutuamente
- lazy-load — só a faixa ativa e as vizinhas baixam
- botão "Ativar som" quando a política de autoplay do navegador exigir um
  gesto antes do primeiro áudio

---

## Trajetória — o cenário 3D (`public/trajetoria/`)

A seção da trajetória deixou de ser procedural. Prédios e carro são modelos
reais, e nas margens ficam recortes do artista em corpo inteiro, dois por era.

### O que está lá

| arquivo | uso |
| --- | --- |
| `predio.glb` | 24 instâncias formando os dois lados da rua |
| `carro.glb` | 3 instâncias: uma acompanha a câmera, duas ficam estacionadas |
| `veigh-<era>-1.png` / `-2.png` | recortes com alpha, o par de cada era (fonte) |
| `veigh-<era>-1.webp` / `-2.webp` | o que o site carrega de fato |

Eras, na ordem da estrada: `dos-predios`, `novo-balanco`, `dos-predios-delux`,
`evom`. O quinto marco ("AGORA") não tem par — não é um disco.

### Dois passos obrigatórios ao trocar um asset

**1. Recorte novo → gerar o webp.**

```
node scripts/otimizar-figuras.mjs
```

Os oito PNG somam 11 MB; os webp somam 0,6 MB com o mesmo alpha. O site lê os
`.webp`; os `.png` ficam só como fonte.

**2. Modelo novo do Sketchfab → checar a extensão de material.**

```
node scripts/glb-specgloss-to-mr.mjs public/trajetoria/<arquivo>.glb
```

Rode isto se o modelo usar `KHR_materials_pbrSpecularGlossiness`. O three 0.185
removeu o suporte a essa extensão: ele não quebra, só imprime "Unknown
extension" e carrega o modelo **branco liso, sem nenhuma textura**. O script
converte para metallic-roughness e, de quebra, repinta a lataria de vinho.

### Custo

A cena desenha ~2,57 milhões de triângulos por quadro em 59 draw calls (o
`carro.glb` sozinho tem 414 mil triângulos). As draw calls estão baixas porque
as malhas que dividem material são fundidas no carregamento — sem isso seriam
cerca de 450. O número de triângulos é alto para GPU integrada: se travar na
sua máquina, os controles são `PREDIOS` e `CARROS` no topo de
`src/components/roadTimeline.js`.
