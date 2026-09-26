<script setup lang="ts">
// Contenu d'une page légale (`/confidentialite`, réutilisable pour de futures mentions légales
// boissons — spec §1 « /confidentialite »). H1 + « Dernière mise à jour » (`<time datetime>`)
// + introduction + sections h2/paragraphes, tout venant du catalogue (type `legal`) — jamais de
// `v-html` (CLAUDE.md).
import { formatDateLongue } from '#shared/utils/dates'
import type { LegalData } from '@/composables/useSiteSections'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const props = defineProps<{ legal: LegalData }>()
</script>

<template>
  <article class="mx-auto max-w-3xl px-6 pb-24 pt-32 md:pb-32 md:pt-40">
    <TexteAccentue :texte="props.legal.titre" as="h1" class="font-display text-4xl font-bold leading-[1.05] text-navy md:text-5xl" />
    <p class="mt-4 text-sm text-ink/75">
      Dernière mise à jour le <time :datetime="props.legal.miseAJour">{{ formatDateLongue(props.legal.miseAJour) }}</time>
    </p>
    <TexteAccentue
      v-if="props.legal.introduction"
      :texte="props.legal.introduction"
      as="p"
      class="mt-8 leading-relaxed text-ink/80"
    />

    <div class="mt-12 space-y-10">
      <!-- Contenu texte édité d'un bloc, jamais réordonné élément par élément : l'index comme clé est sûr. -->
      <section v-for="(section, index) in props.legal.sections" :key="index">
        <TexteAccentue :texte="section.titre" as="h2" class="font-display text-2xl font-bold text-navy" />
        <TexteAccentue
          v-for="(paragraphe, pIndex) in section.paragraphes"
          :key="pIndex"
          :texte="paragraphe"
          as="p"
          class="mt-4 leading-relaxed text-ink/75"
        />
      </section>
    </div>
  </article>
</template>
