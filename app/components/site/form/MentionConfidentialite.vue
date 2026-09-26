<script setup lang="ts">
// Mention Loi 25 sous les formulaires publics (spec §4.1, Q-01) : texte du groupe (édité une
// seule fois, `COMMUN:mentionFormulaires`, holding) + lien vers la politique. Le lien reste
// affiché même si le texte n'est pas encore éditée (site fraîchement semé, seed non appliqué).
import type { TexteVars } from '#shared/utils/texte'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

defineProps<{
  texte: string | null
  vars?: TexteVars
}>()
</script>

<template>
  <p class="text-xs text-ink/70">
    <TexteAccentue v-if="texte" :texte="texte" :vars="vars" as="span" />
    <NuxtLink to="/confidentialite" class="ml-1 underline underline-offset-2 hover:text-site-accent-strong">
      Politique de confidentialité
    </NuxtLink>
  </p>
</template>
