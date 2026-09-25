<script setup lang="ts">
// Rendu des textes éditoriaux du catalogue de sections — jamais de `v-html` (CLAUDE.md,
// PROJECT_STATE règle T3). `*accent*` devient un segment en italique/poids moyen, `\n` un
// retour à la ligne, {groupe}/{nomCourt}/{nom} sont interpolées (shared/utils/texte.ts, T0).
// Les variables du site courant (useSiteTextVars) sont appliquées par défaut : un appelant qui
// oublie de passer `vars` interpole quand même — c'est la correction centrale du bug des
// placeholders `{groupe}`/`{nomCourt}` laissés en clair sur les pages publiques.
import type { HTMLAttributes } from 'vue'
import { mergerVars, texteAccentueSegments, type TexteVars } from '#shared/utils/texte'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    texte: string
    vars?: TexteVars
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
    class?: HTMLAttributes['class']
  }>(),
  { as: 'p' },
)

const siteVars = useSiteTextVars()
const resolvedVars = computed<TexteVars>(() => mergerVars(siteVars.value, props.vars))

// Segments dérivés d'une chaîne de contenu : pas d'identité propre à préserver entre rendus
// (la liste entière est recalculée si `texte` change), l'index comme clé est donc sûr ici.
const segments = computed(() => texteAccentueSegments(props.texte, resolvedVars.value))
</script>

<template>
  <component :is="as" :class="cn(props.class)">
    <template v-for="(segment, index) in segments" :key="index">
      <br v-if="segment.type === 'saut'" />
      <em v-else-if="segment.type === 'accent'" class="font-medium italic">{{ segment.valeur }}</em>
      <template v-else>{{ segment.valeur }}</template>
    </template>
  </component>
</template>
