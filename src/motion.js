/**
 * Política de movimento do site.
 *
 * Histórico do problema que isto resolve: cada seção decidia sozinha o que
 * fazer com `prefers-reduced-motion`, e a decisão era "mostrar o estado final
 * estático". Numa máquina com os efeitos de animação do Windows desligados —
 * que é o caso do dono do site — isso significava um site sem o vídeo da
 * intro, sem scroll narrativo e sem nenhuma das animações. Uma página morta.
 *
 * Reduzir movimento é tirar o que causa desconforto vestibular (scrub, parallax,
 * zoom, glitch, coisa que se move sozinha na periferia), NÃO apagar o conteúdo.
 * Vídeo continua tocando, seções continuam existindo, fades continuam.
 *
 * Três modos:
 *   'full'    — a experiência inteira: scrub, parallax, glitch, 3D.
 *   'calm'    — conteúdo todo presente, vídeo tocando, só fades curtos.
 *   (a escolha explícita do usuário sempre vence a preferência do sistema)
 */

const STORAGE_KEY = 'evom:motion'

export const FULL = 'full'
export const CALM = 'calm'

/** Preferência do sistema, sem considerar overrides. */
export function systemPrefersReduced() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Ordem de precedência: ?motion= na URL > escolha salva > preferência do
 * sistema. A URL vem primeiro porque é a forma de revisar sem mexer em config.
 */
export function readMotionMode() {
  if (typeof window === 'undefined') return CALM

  const fromUrl = new URLSearchParams(window.location.search).get('motion')
  if (fromUrl === 'full' || fromUrl === 'calm') return fromUrl

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === FULL || saved === CALM) return saved
  } catch {
    // modo privativo / storage bloqueado: cai na preferência do sistema
  }

  return systemPrefersReduced() ? CALM : FULL
}

/**
 * Grava a escolha e recarrega. O reload é intencional: as timelines do GSAP são
 * construídas uma vez na montagem, com ScrollTriggers e pins já calculados —
 * reconstruir tudo em runtime seria mais frágil do que simplesmente remontar a
 * página no modo novo.
 */
export function setMotionMode(mode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // sem storage: mantém a escolha só nesta navegação, via querystring
    const url = new URL(window.location.href)
    url.searchParams.set('motion', mode)
    window.location.replace(url.toString())
    return
  }
  window.location.reload()
}

/** Atalho: true quando o modo é o calmo. */
export function isCalm(mode) {
  return mode === CALM
}
