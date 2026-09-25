import { usePreferredReducedMotion } from '@vueuse/core'

const REVEAL_DISTANCE_PX = 24
const REVEAL_DURATION_MS = 500
const REVEAL_STAGGER_MS = 80

export interface RevealMotion {
  readonly initial: Record<string, unknown>
  readonly visibleOnce: Record<string, unknown>
}

/**
 * Presets `@vueuse/motion` (fondu vers le haut, une seule fois à l'entrée dans le viewport) —
 * spec §4.3. Désactivés si `prefers-reduced-motion: reduce`. Consommé sur un élément via
 * `v-motion v-bind="reveal(index)"`.
 */
export function useReveal() {
  const reducedMotion = usePreferredReducedMotion()

  function reveal(index = 0): RevealMotion {
    if (reducedMotion.value === 'reduce') {
      return { initial: {}, visibleOnce: {} }
    }
    return {
      initial: { opacity: 0, y: REVEAL_DISTANCE_PX },
      visibleOnce: {
        opacity: 1,
        y: 0,
        transition: { duration: REVEAL_DURATION_MS, delay: index * REVEAL_STAGGER_MS },
      },
    }
  }

  return { reveal }
}
