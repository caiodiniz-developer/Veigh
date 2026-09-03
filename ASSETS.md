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
