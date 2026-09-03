# Pipeline dos vídeos

## hero-scrub.mp4 — o vídeo da intro (scrubado pelo scroll)

`hero.mp4` (o master, 1080p60, com áudio) **não serve para scrub**: ele tem só
11 keyframes em 304 frames, um I-frame a cada ~0,46s. Como o scroll pede um
`currentTime` arbitrário, o browser precisa decodificar toda a cadeia de frames
desde o keyframe anterior — até 27 frames por seek. É isso que trava o scroll.

`hero-scrub.mp4` é a versão **all-intra**: keyframe em todo frame, então
qualquer `currentTime` é acesso direto.

Medido no Chrome (tempo até o frame ser apresentado, via `requestVideoFrameCallback`,
mediana de 60 seeks):

| padrão de seek     | hero.mp4 | hero-scrub.mp4 |
| ------------------ | -------- | -------------- |
| scroll pra frente  | 505,6 ms | 7 ms           |
| scroll pra trás    | 27,8 ms  | 7 ms           |
| saltos aleatórios  | 27,9 ms  | 7 ms           |

### Como regerar

```sh
ffmpeg -i hero.mp4 -an \
  -vf "scale=1920:1080,fps=30" \
  -c:v libx264 -preset slow -x264-params keyint=1:scenecut=0 \
  -crf 20 -pix_fmt yuv420p -movflags +faststart \
  hero-scrub.mp4
```

- `keyint=1:scenecut=0` — todo frame é keyframe. É o ponto todo.
- `fps=30` — o master é 60fps; 30 basta para scrub e corta o arquivo pela metade.
  Se mudar isso, ajuste a prop `scrubFps` de `<IntroSequence>`, que quantiza o
  seek pro frame mais próximo e evita seeks redundantes.
- `-an` — o vídeo scrubado nunca toca áudio.
- `+faststart` — move o átomo `moov` pro início. Sem isso o browser precisa
  baixar o arquivo inteiro antes do primeiro frame (era o caso do `hero.mp4`).

Resultado: 11,3 MB em 1080p. Custo aceitável pelo ganho de fluidez.

## video-sessao1.mp4 — ambiente da seção "A História"

Toca em loop normal, não é scrubado. Não precisa de tratamento all-intra.
