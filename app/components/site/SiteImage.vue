<script setup lang="ts">
// Image publique (héros, équipe, partenaires...) servie via /api/files/[key] (jamais de
// fichier statique hors passerelle applicative, CLAUDE.md §Backend). Repli sans dégradé
// (CLAUDE.md §Design) : aplat teinté de l'accent du site + initiales.
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

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
  }>(),
  { initiales: '', priority: false, tone: 'clair' },
)

const fondRepli = computed(() => (props.tone === 'sombre' ? 'bg-cream/15' : 'bg-site-accent/10'))
const texteInitiales = computed(() => (props.tone === 'sombre' ? 'text-cream' : 'text-site-accent-strong'))
</script>

<template>
  <img
    v-if="props.fileKey"
    :src="`/api/files/${props.fileKey}`"
    :alt="props.alt"
    :loading="props.priority ? 'eager' : 'lazy'"
    :fetchpriority="props.priority ? 'high' : undefined"
    :class="cn('object-cover', props.class)"
  />
  <div
    v-else
    role="img"
    :aria-label="props.alt"
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
