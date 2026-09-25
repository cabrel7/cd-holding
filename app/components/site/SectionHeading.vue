<script setup lang="ts">
// En-tête de section réutilisable (surtitre + titre + texte optionnel), consommant une entrée
// du catalogue de type `section` (spec §4.3, §1.4). `tone` ajuste titre/texte/surtitre au fond
// de la section (WCAG AA — audit ux-reviewer : `--site-accent-strong` sur fond clair, cream/90
// sur fond sombre, l'accent brut y étant parfois illisible selon la couleur de la filiale).
import type { SectionData } from '@/composables/useSiteSections'
import type { TexteVars } from '#shared/utils/texte'
import TexteAccentue from './TexteAccentue.vue'

const props = withDefaults(
  defineProps<{
    section: SectionData
    tone: 'clair' | 'sombre'
    vars?: TexteVars
  }>(),
  { vars: () => ({}) },
)

const titreClass = computed(() =>
  props.tone === 'sombre' ? 'text-cream' : 'text-navy',
)
const texteClass = computed(() =>
  props.tone === 'sombre' ? 'text-cream/75' : 'text-ink/70',
)
// `--site-accent-strong` est calculé pour le petit texte sur fond clair (spec §4.3) ; sur fond
// sombre il assombrit encore l'accent (déjà peu lisible sur navy pour certaines filiales) —
// même traitement que les autres petits libellés sur navy (SiteFooter, membre.poste : cream/90).
const surtitreClass = computed(() =>
  props.tone === 'sombre' ? 'text-cream/90' : 'text-site-accent-strong',
)
</script>

<template>
  <div>
    <TexteAccentue
      v-if="section.surtitre"
      :texte="section.surtitre"
      :vars="vars"
      as="p"
      :class="`font-display text-xs font-semibold uppercase tracking-[0.3em] ${surtitreClass}`"
    />
    <TexteAccentue
      :texte="section.titre"
      :vars="vars"
      as="h2"
      :class="`mt-3 font-display text-4xl font-bold leading-[1.05] md:text-5xl ${titreClass}`"
    />
    <TexteAccentue
      v-if="section.texte"
      :texte="section.texte"
      :vars="vars"
      as="p"
      :class="`mt-4 max-w-2xl leading-relaxed ${texteClass}`"
    />
  </div>
</template>
