<script setup lang="ts">
// CTA de fin de page, réutilisable (accueils holding/filiales, pages services — type catalogue
// `cta`, spec phase 3 §4.1). Un seul CTA par section consommée (skill ui-ux §1 : une intention).
import { ArrowRight } from '@lucide/vue'
import type { TexteVars } from '#shared/utils/texte'
import type { CtaData } from '@/composables/useSiteSections'
import TexteAccentue from './TexteAccentue.vue'

const props = withDefaults(
  defineProps<{
    cta: CtaData
    to: string
    tone?: 'clair' | 'sombre'
    vars?: TexteVars
  }>(),
  { tone: 'clair', vars: () => ({}) },
)

const titreClass = computed(() => (props.tone === 'sombre' ? 'text-cream' : 'text-navy'))
const texteClass = computed(() => (props.tone === 'sombre' ? 'text-cream/75' : 'text-ink/75'))
</script>

<template>
  <section class="py-24 md:py-28">
    <div class="mx-auto max-w-4xl px-6 text-center">
      <TexteAccentue
        :texte="props.cta.titre"
        :vars="props.vars"
        as="h2"
        :class="`font-display text-4xl font-bold leading-[1.05] md:text-5xl ${titreClass}`"
      />
      <TexteAccentue
        v-if="props.cta.texte"
        :texte="props.cta.texte"
        :vars="props.vars"
        as="p"
        :class="`mx-auto mt-6 max-w-xl leading-relaxed ${texteClass}`"
      />
      <NuxtLink
        :to="props.to"
        class="mt-10 inline-flex items-center gap-2 rounded-full bg-navy px-8 py-4 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
      >
        {{ props.cta.ctaLibelle }}
        <ArrowRight :size="16" aria-hidden="true" />
      </NuxtLink>
    </div>
  </section>
</template>
