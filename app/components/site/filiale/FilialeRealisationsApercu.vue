<script setup lang="ts">
// Aperçu "Nos réalisations" de l'accueil filiale (fond navy), spec lot1 §1. Colonnes selon le
// nombre d'éléments renvoyés par l'API (1, 2 ou 3, plafond APERCU_COLLECTION) — jamais un `if`
// par slug : « placement en a 2 » ne veut dire que « ce site a 2 réalisations aujourd'hui ».
import { ArrowRight } from '@lucide/vue'
import { formatMoisAnnee } from '#shared/utils/dates'
import type { FilialeSlug } from '#shared/config/sites'
import type { PublicRealisationDto } from '#shared/types/public'
import type { SectionData } from '@/composables/useSiteSections'
import EtatCollection from '@/components/site/EtatCollection.vue'
import SectionHeading from '@/components/site/SectionHeading.vue'
import SiteImage from '@/components/site/SiteImage.vue'

const props = defineProps<{
  heading: SectionData | undefined
  realisations: PublicRealisationDto[] | null
  pending: boolean
  error: boolean
  slug: FilialeSlug
}>()

defineEmits<{ retry: [] }>()

const { reveal } = useReveal()

const empty = computed(() => !props.pending && !props.error && !props.realisations?.length)

const colsClass = computed(() => {
  const total = props.realisations?.length ?? 0
  if (total >= 3) return 'md:grid-cols-3'
  if (total === 2) return 'md:grid-cols-2'
  return 'md:max-w-md md:grid-cols-1'
})
</script>

<template>
  <section class="bg-navy py-24 text-cream md:py-28">
    <div class="mx-auto max-w-7xl px-6">
      <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading v-if="heading" :section="heading" tone="sombre" class="max-w-xl" />
        <NuxtLink
          :to="`/${slug}/realisations`"
          class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cream hover:opacity-80"
        >
          Voir toutes les réalisations
          <ArrowRight :size="16" aria-hidden="true" />
        </NuxtLink>
      </div>

      <EtatCollection
        class="mt-14"
        tone="sombre"
        :pending="pending"
        :error="error"
        :empty="empty"
        empty-message="Aucune réalisation à afficher pour le moment."
        @retry="$emit('retry')"
      >
        <div class="grid grid-cols-1 gap-8" :class="colsClass">
          <article v-for="(realisation, index) in realisations" :key="realisation.uuid" v-motion v-bind="reveal(index)">
            <div class="overflow-hidden rounded-2xl">
              <SiteImage
                :file-key="realisation.imageKey"
                :alt="realisation.titre"
                fallback="aplat"
                tone="sombre"
                :initiales="realisation.titre.charAt(0)"
                class="aspect-[4/5] w-full"
              />
            </div>
            <p v-if="realisation.dateRealisation" class="mt-4 text-xs uppercase tracking-widest text-cream/60">
              {{ formatMoisAnnee(realisation.dateRealisation) }}
            </p>
            <h3 class="mt-2 font-display text-xl font-bold">{{ realisation.titre }}</h3>
          </article>
        </div>
      </EtatCollection>
    </div>
  </section>
</template>
