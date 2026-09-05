/**
 * Manifesto único de assets.
 *
 * Todo caminho de arquivo do site sai daqui. Motivo: quando a pasta public/ foi
 * reorganizada em subpastas, cada componente que tinha o path escrito no meio do
 * código quebrou em silêncio (404 sem erro visível, só a tela vazia). Com o
 * manifesto, uma reorganização é uma edição só — e um path errado aparece na
 * checagem de assets em vez de virar um buraco na página.
 *
 * Convenção dos arquivos: minúsculo, ASCII, hífen. Sem espaço e sem acento,
 * porque servidor de produção é case-sensitive e path com %20/%C3%A9 quebra em
 * parte dos CDNs.
 */

export const VIDEOS = {
  // Versão all-intra do clipe da intro: keyframe em todo frame, é o que permite
  // o scrub fluido. Ver public/README-video.md antes de trocar este arquivo.
  heroScrub: '/videos/hero-scrub.mp4',
  // Master original (1080p60, com áudio). Não é usado em runtime — existe só
  // como fonte para regerar o hero-scrub.
  heroMaster: '/videos/hero.mp4',
  sessao1: '/videos/sessao1.mp4',
  sessao1Poster: '/videos/sessao1-poster.jpg',
}

/** Recorte do artista em corpo inteiro, com alpha. Usado no palco. */
export const VEIGH_CUTOUT = '/veigh-sem-fundo.png'

/** Os 4 pingentes de joia que formam EVOM na intro. */
export const PENDANTS = ['/logos/e.png', '/logos/v.png', '/logos/o.png', '/logos/m.png']

export const CAPAS = {
  dosPredios: '/capas/dos-predios.jpg',
  dosPrediosDeluxe: '/capas/dos-predios-deluxe.jpg',
  euVenciOMundo: '/capas/eu-venci-o-mundo.jpg',
  novoBalanco: '/capas/novo-balanco.jpg',
}

const range = (n, make) => Array.from({ length: n }, (_, i) => make(i + 1))

/** Fotos por era. Note que "Eu Venci o Mundo" começa no 2 — não existe a 1. */
export const ERA = {
  dosPredios: range(6, (i) => `/era/dos-predios-${i}.jpg`),
  dosPrediosDeluxe: range(6, (i) => `/era/dos-predios-deluxe-${i}.jpg`),
  euVenciOMundo: range(5, (i) => `/era/eu-venci-o-mundo-${i + 1}.jpg`),
}

/**
 * A trajetória: o cenário 3D e os recortes do artista.
 *
 * Os .glb são modelos reais (Sketchfab), não geometria gerada por código. Os
 * recortes vêm em PNG RGBA como fonte e em .webp para o runtime — o PNG dos
 * oito somava 11 MB, o webp soma 0,6 MB com o mesmo alpha. Regerar:
 * node scripts/otimizar-figuras.mjs
 *
 * O carro.glb foi convertido de KHR_materials_pbrSpecularGlossiness para
 * metallic-roughness porque o three 0.185 não lê mais aquela extensão:
 * node scripts/glb-specgloss-to-mr.mjs public/trajetoria/carro.glb
 */
const figura = (nome) => [
  `/trajetoria/veigh-${nome}-1.webp`,
  `/trajetoria/veigh-${nome}-2.webp`,
]

export const TRAJETORIA = {
  carro: '/trajetoria/carro.glb',
  predio: '/trajetoria/predio.glb',
  dosPredios: figura('dos-predios'),
  novoBalanco: figura('novo-balanco'),
  dosPrediosDeluxe: figura('dos-predios-delux'),
  euVenciOMundo: figura('evom'),
}

export const SHOWS = range(6, (i) => `/shows/show-${i}.jpg`)

/** Vídeos de clipe. Duram de 38s a 69s — não são previews curtos. */
export const CLIPES = range(6, (i) => `/clipes/clipe-${i}.mp4`)

/** Tracklist de "Eu Venci o Mundo", na ordem do disco. */
export const TRACKLIST = [
  'Reuniões comigo mesmo',
  'Hiperfoco',
  'Ausência',
  'Artista Genérico',
  'Taylor',
  'Belieber',
  'Talvez você precise de mim',
  'Dono da Verdade',
  'Mônaco Freestyle',
  'Filho da Promessa',
  'Perdoe-me por ser um astro',
  'Sangue do Cordeiro',
  'Visões',
  'Indiretas com a voz',
  'Influencie',
  'Amor Fictício',
]

/** Todo asset referenciado pelo site, para a checagem de integridade. */
export const ALL_ASSETS = [
  ...Object.values(VIDEOS),
  VEIGH_CUTOUT,
  ...PENDANTS,
  ...Object.values(CAPAS),
  ...ERA.dosPredios,
  ...ERA.dosPrediosDeluxe,
  ...ERA.euVenciOMundo,
  ...SHOWS,
  ...CLIPES,
  TRAJETORIA.carro,
  TRAJETORIA.predio,
  ...TRAJETORIA.dosPredios,
  ...TRAJETORIA.novoBalanco,
  ...TRAJETORIA.dosPrediosDeluxe,
  ...TRAJETORIA.euVenciOMundo,
]

/**
 * Links para streaming.
 *
 * Não tenho os IDs reais do artista, do álbum nem das faixas no Spotify, e
 * inventar um ID leva a uma página errada ou a um 404. Então o padrão é a
 * busca do próprio Spotify, que resolve sempre e abre no app quando instalado.
 *
 * Quando você tiver os links reais, preencha ARTIST/ALBUM e o mapa TRACK_URLS
 * (título da faixa -> URL). Quem tiver link direto passa a usar o link; quem
 * não tiver continua caindo na busca. Nenhuma outra mudança é necessária.
 */
export const SPOTIFY = {
  ARTIST: null, // ex.: 'https://open.spotify.com/artist/xxxxxxxx'
  ALBUM: null, // ex.: 'https://open.spotify.com/album/xxxxxxxx'
  TRACK_URLS: {
    // 'Taylor': 'https://open.spotify.com/track/xxxxxxxx',
  },
}

/** URL de busca do Spotify para um termo. */
export const spotifySearch = (query) =>
  `https://open.spotify.com/search/${encodeURIComponent(query)}`

/** Melhor link disponível para uma faixa: direto se existir, busca se não. */
export const spotifyForTrack = (title) =>
  SPOTIFY.TRACK_URLS[title] || spotifySearch(`Veigh ${title}`)

/** Melhor link disponível para o álbum. */
export const spotifyForAlbum = () =>
  SPOTIFY.ALBUM || spotifySearch('Veigh Eu Venci o Mundo')
