<script setup lang="ts">
// Mention Loi 25 sous les formulaires publics (spec §4.1, Q-01) : texte du groupe (édité une
// seule fois, `COMMUN:mentionFormulaires`, holding) + lien vers la politique. Le lien reste
// affiché même si le texte n'est pas encore éditée (site fraîchement semé, seed non appliqué).
// `tone="sombre"` : variante pour les cartes navy/accent (blanc cassé, lien souligné).
import type { TexteVars } from '#shared/utils/texte'
import type { ToneFormulaire } from '@/utils/formClasses'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

withDefaults(
  defineProps<{
    texte: string | null
    vars?: TexteVars
    tone?: ToneFormulaire
  }>(),
  { tone: 'clair' },
)
</script>

<template>
  <p class="text-xs" :class="tone === 'sombre' ? 'text-white/80' : 'text-ink/70'">
    <TexteAccentue v-if="texte" :texte="texte" :vars="vars" as="span" />
    <NuxtLink
      to="/confidentialite"
      class="ml-1 rounded-sm py-3 underline underline-offset-2"
      :class="
        tone === 'sombre'
          ? 'hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
          : 'hover:text-site-accent-strong'
      "
    >
      Politique de confidentialité
    </NuxtLink>
  </p>
</template>
