<script setup lang="ts">
// Image publique (héros, équipe, partenaires...) servie via /api/files/[key] (jamais de
// fichier statique hors passerelle applicative, CLAUDE.md §Backend). Dérivés WebP
// responsives générés à la volée (voir shared/utils/image-src.ts). Repli sans dégradé
// (CLAUDE.md §Design) : aplat teinté de l'accent du site + initiales.
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { srcsetImage, srcsetImageMax, urlImage, type LargeurDerivee } from '#shared/utils/image-src'

const props = withDefaults(
  defineProps<{
    fileKey: string | null
    alt: string
    /** 'initiales' : petit repli (avatar équipe/logo partenaire). 'aplat' : grand repli décoratif. */
    fallback: 'initiales' | 'aplat'
    initiales?: string
    class?: HTMLAttributes['class']
    /** Image candidate LCP (ex. hero) : chargement immédiat plutôt que différé. */
    priority?: boolean
    /**
     * Fond de la section hôte. `--site-accent-strong` n'est lisible que sur fond clair : sur
     * navy il assombrit encore l'accent (≈1,5:1) — le repli passe alors en crème (WCAG AA).
     */
    tone?: 'clair' | 'sombre'
    /** Image purement décorative : `alt` vide et repli masqué aux technologies d'assistance. */
    decorative?: boolean
    /** Hinte de dimension (`sizes` du navigateur) : active le srcset responsive. */
    sizes?: string
    /** Plafond de largeur (avatars, vignettes) : une seule variante WebP sous ce plafond. */
    largeurMax?: LargeurDerivee
  }>(),
  { initiales: '', priority: false, tone: 'clair', decorative: false, sizes: undefined, largeurMax: undefined },
)

const fondRepli = computed(() => (props.tone === 'sombre' ? 'bg-cream/15' : 'bg-site-accent/10'))
const texteInitiales = computed(() => (props.tone === 'sombre' ? 'text-cream' : 'text-site-accent-strong'))

// Sans sizes → srcset inutile (le navigateur viderait 100vw) : une seule URL WebP, convertie
// sans redimensionnement. largeurMax prime sur sizes (vignette qui n'a jamais besoin du ladder).
const src = computed(() => {
  if (!props.fileKey) return ''
  if (props.largeurMax) return srcsetImageMax(props.fileKey, props.largeurMax)
  if (props.sizes) return urlImage(props.fileKey, { largeur: 1024, format: 'webp' })
  return urlImage(props.fileKey, { format: 'webp' })
})
const srcset = computed(() => {
  if (!props.fileKey || props.largeurMax || !props.sizes) return undefined
  return srcsetImage(props.fileKey)
})
</script>

<template>
  <img
    v-if="props.fileKey"
    :src="src"
    :srcset="srcset"
    :sizes="props.sizes"
    :alt="props.decorative ? '' : props.alt"
    :loading="props.priority ? 'eager' : 'lazy'"
    :fetchpriority="props.priority ? 'high' : undefined"
    :class="cn('object-cover', props.class)"
  />
  <div
    v-else
    :role="props.decorative ? undefined : 'img'"
    :aria-label="props.decorative ? undefined : props.alt"
    :aria-hidden="props.decorative ? 'true' : undefined"
    :class="cn('flex items-center justify-center', fondRepli, props.class)"
  >
    <span
      v-if="props.fallback === 'initiales'"
      :class="['font-display text-lg font-bold', texteInitiales]"
    >
      {{ props.initiales }}
    </span>
    <span v-else class="font-display text-8xl font-bold leading-none text-site-accent/40">
      {{ props.initiales }}
    </span>
  </div>
</template>
