<script setup lang="ts">
// En-tête de section réutilisable (surtitre + titre + texte optionnel), consommant une entrée
// du catalogue de type `section` (spec §4.3, §1.4). Le surtitre garde l'accent brut (§6 —
// « Accents inchangés », points ouverts n°2) ; `tone` ajuste titre/texte au fond de la section.
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
</script>

<template>
  <div>
    <p
      v-if="section.surtitre"
      class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent"
    >
      {{ section.surtitre }}
    </p>
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
