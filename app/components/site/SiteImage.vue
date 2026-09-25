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
  }>(),
  { initiales: '' },
)
</script>

<template>
  <img
    v-if="props.fileKey"
    :src="`/api/files/${props.fileKey}`"
    :alt="props.alt"
    loading="lazy"
    :class="cn('object-cover', props.class)"
  />
  <div
    v-else
    role="img"
    :aria-label="props.alt"
    :class="cn('flex items-center justify-center bg-site-accent/10', props.class)"
  >
    <span
      v-if="props.fallback === 'initiales'"
      class="font-display text-lg font-bold text-site-accent-strong"
    >
      {{ props.initiales }}
    </span>
    <span v-else class="font-display text-8xl font-bold leading-none text-site-accent/40">
      {{ props.initiales }}
    </span>
  </div>
</template>
