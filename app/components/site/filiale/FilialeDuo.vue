<script setup lang="ts">
// Duo de cartes de l'accueil (Employeurs/Candidats — placement ; Import-export/Restaurant —
// cdpaa), spec lot1 §1 : affiché si la section `audiences`/`metiers` existe, aucun `if` par
// slug. Carte image (bandeau bg-navy/85) si `imageKey`, sinon aplat plein (a : bg-navy,
// b : bg-site-accent-strong) — jamais de dégradé (CLAUDE.md §Design).
import { ArrowRight } from '@lucide/vue'
import { interpoler } from '#shared/utils/texte'
import type { DuoCoteData, DuoData } from '@/composables/useSiteSections'
import SiteImage from '@/components/site/SiteImage.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const props = defineProps<{
  duo: DuoData
  liens: { a: string; b: string }
}>()

const siteVars = useSiteTextVars()

function imageAlt(cote: DuoCoteData): string {
  return interpoler(cote.imageAlt ?? cote.titre, siteVars.value)
}

const cotes = computed(() => [
  { id: 'a' as const, cote: props.duo.a, lien: props.liens.a, aplat: 'bg-navy' },
  { id: 'b' as const, cote: props.duo.b, lien: props.liens.b, aplat: 'bg-site-accent-strong' },
])
</script>

<template>
  <section class="py-24 md:py-28">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 md:grid-cols-2">
      <article
        v-for="{ id, cote, lien, aplat } in cotes"
        :key="id"
        class="group relative overflow-hidden rounded-[1.5rem] shadow-xl"
        :class="cote.imageKey ? 'aspect-[4/5]' : ['p-8', aplat, 'md:p-10']"
      >
        <SiteImage
          v-if="cote.imageKey"
          :file-key="cote.imageKey"
          :alt="imageAlt(cote)"
          fallback="aplat"
          class="absolute inset-0 h-full w-full"
        />
        <div :class="cote.imageKey ? 'absolute inset-x-0 bottom-0 bg-navy/85 p-6' : ''">
          <TexteAccentue
            v-if="cote.surtitre"
            :texte="cote.surtitre"
            as="p"
            class="text-xs uppercase tracking-widest text-cream/90"
          />
          <TexteAccentue
            :texte="cote.titre"
            as="h3"
            class="mt-3 font-display text-3xl font-bold leading-tight text-cream md:text-4xl"
          />
          <TexteAccentue
            v-if="cote.texte"
            :texte="cote.texte"
            as="p"
            class="mt-3 max-w-sm text-cream/85"
          />
          <NuxtLink
            :to="lien"
            class="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cream"
          >
            {{ cote.lienLibelle }}
            <ArrowRight
              :size="16"
              aria-hidden="true"
              class="transition-transform group-hover:translate-x-0.5"
            />
          </NuxtLink>
        </div>
      </article>
    </div>
  </section>
</template>
