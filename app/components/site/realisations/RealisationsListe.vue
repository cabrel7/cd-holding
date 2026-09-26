<script setup lang="ts">
// Contenu de `/{filiale}/realisations` et `/realisations` (holding, DEC-39) — pages minces qui
// délèguent tout ici (spec §1 « Grille éditoriale »). Grille via la fonction pure
// `classesRealisation` (spec §0 : jamais l'`aspect` sur l'`<article>`, sinon hauteurs
// incohérentes et trou visible avec peu d'éléments).
import { REALISATIONS_MAX } from '#shared/config/public'
import type { SiteSlug } from '#shared/config/sites'
import type { PublicRealisationDto } from '#shared/types/public'
import type { SectionData, SeoData } from '@/composables/useSiteSections'
import { classesRealisation } from '@/utils/grilleRealisations'
import { formatMoisAnnee } from '#shared/utils/dates'
import TexteAccentue from '@/components/site/TexteAccentue.vue'
import SiteImage from '@/components/site/SiteImage.vue'
import EtatCollection from '@/components/site/EtatCollection.vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{ slug: SiteSlug }>()

const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(props.slug, 'REALISATIONS')
const {
  data: realisations,
  status: realisationsStatus,
  error: realisationsError,
  refresh: refreshRealisations,
} = await useSiteCollection<PublicRealisationDto>(props.slug, 'realisations', { limit: REALISATIONS_MAX })

const { reveal } = useReveal()

const entete = computed(() => sections.value?.entete as SectionData | undefined)
const seo = computed(() => sections.value?.seo as SeoData | undefined)

// Classes de grille précalculées : évite d'appeler `classesRealisation` deux fois par ligne du
// template (col + aspect) et garde le template sans logique (skill vue3).
const rangees = computed(() => {
  const total = realisations.value?.length ?? 0
  return (realisations.value ?? []).map((realisation, index) => ({
    realisation,
    classes: classesRealisation(index, total),
  }))
})

useSeoMeta({
  title: () => seo.value?.title ?? entete.value?.titre ?? 'Réalisations',
  description: () => seo.value?.description ?? entete.value?.texte ?? '',
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <section v-else class="pb-24 pt-32 md:pb-32 md:pt-40">
    <div class="mx-auto max-w-7xl px-6">
      <template v-if="entete">
        <TexteAccentue
          v-if="entete.surtitre"
          :texte="entete.surtitre"
          as="p"
          class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
        />
        <TexteAccentue
          :texte="entete.titre"
          as="h1"
          class="mt-3 max-w-3xl font-display text-5xl font-bold leading-[1.02] text-navy md:text-7xl"
        />
        <TexteAccentue
          v-if="entete.texte"
          :texte="entete.texte"
          as="p"
          class="mt-4 max-w-2xl leading-relaxed text-ink/70"
        />
      </template>

      <EtatCollection
        class="mt-20"
        :pending="realisationsStatus === 'pending'"
        :error="!!realisationsError"
        :empty="realisationsStatus === 'success' && !realisations?.length"
        empty-message="Aucune réalisation à afficher pour le moment."
        @retry="refreshRealisations()"
      >
        <div class="grid grid-cols-1 gap-8 md:grid-cols-12">
          <article
            v-for="({ realisation, classes }, index) in rangees"
            :key="realisation.uuid"
            v-motion
            v-bind="reveal(index % 3)"
            :class="classes.col"
          >
            <div class="group overflow-hidden rounded-[1.25rem]" :class="classes.aspect">
              <SiteImage
                :file-key="realisation.imageKey"
                :alt="realisation.titre"
                fallback="aplat"
                :initiales="realisation.titre.charAt(0)"
                class="h-full w-full transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <p v-if="realisation.dateRealisation" class="mt-4 text-xs uppercase tracking-widest text-ink/55">
              {{ formatMoisAnnee(realisation.dateRealisation) }}
            </p>
            <h2 class="mt-2 font-display text-2xl font-bold text-navy">{{ realisation.titre }}</h2>
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink/75">{{ realisation.description }}</p>
          </article>
        </div>
      </EtatCollection>
    </div>
  </section>
</template>
