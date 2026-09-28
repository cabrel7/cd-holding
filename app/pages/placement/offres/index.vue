<script setup lang="ts">
// Liste des offres de placement (spec docs/specs/lot3-pages-specifiques.md §4, écarts assumés
// #1-#2 : H1 éditable + compteur séparé — jamais « 0 mandats » comme le prototype — et CTA vers
// une page de candidature spontanée dédiée). Route statique : `/placement` reste servi par
// `[filiale]/index.vue`, `useCurrentSiteSlug` résout `placement` au premier segment du chemin.
import { CANDIDATURE_SPONTANEE_PATH } from '#shared/config/candidature'
import { interpoler } from '#shared/utils/texte'
import type { PublicOffreDto } from '#shared/types/public'
import type { CtaData, SectionData, SeoData } from '@/composables/useSiteSections'
import EtatCollection from '@/components/site/EtatCollection.vue'
import SectionCta from '@/components/site/SectionCta.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'
import OffreLigne from '@/components/site/placement/OffreLigne.vue'
import { Button } from '@/components/ui/button'

const VIDE_TITRE = 'Aucune offre ouverte pour le moment'
const VIDE_TEXTE = 'Nos postes changent souvent : envoyez-nous votre candidature et nous vous recontacterons dès qu’un poste correspond à votre profil.'
const VIDE_ACTION = 'Envoyer une candidature spontanée'

const slug = useCurrentSiteSlug()
const { data: site } = await useSite(slug)
const { data: sections, error: sectionsError, refresh: refreshSections } = await useSiteSections(slug, 'OFFRES')
const {
  data: offres,
  status: offresStatus,
  error: offresError,
  refresh: refreshOffres,
} = await useFetch<PublicOffreDto[]>('/api/public/placement/offres', { key: 'placement-offres' })

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? 'Placement CD Pro')
const vars = computed(() => ({ nomCourt: nomCourt.value, nom: site.value?.nom }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const entete = computed(() => sections.value?.entete as SectionData | undefined)
const cta = computed(() => sections.value?.cta as CtaData | undefined)

// Libellé d'interface (jamais éditable) — le nombre réel de postes, distinct du H1 éditorial
// qui ne peut pas contenir un compte à jour de façon fiable (spec §1).
const compteur = computed(() => {
  const n = offres.value?.length ?? 0
  return `${n} poste${n > 1 ? 's' : ''} ouvert${n > 1 ? 's' : ''}`
})

useSeoMeta({
  title: () => interpoler(seo.value?.title ?? `Offres d’emploi — ${nomCourt.value}`, vars.value),
  description: () => interpoler(seo.value?.description ?? `Postes ouverts chez ${nomCourt.value}.`, vars.value),
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <section class="pb-16 pt-32 md:pb-20 md:pt-40">
      <div class="mx-auto max-w-5xl px-6">
        <div v-if="!entete" class="h-40 animate-pulse rounded-3xl bg-secondary" aria-hidden="true" />
        <template v-else>
          <TexteAccentue
            v-if="entete.surtitre"
            :texte="entete.surtitre"
            :vars="vars"
            as="p"
            class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
          />
          <TexteAccentue
            :texte="entete.titre"
            :vars="vars"
            as="h1"
            class="mt-3 max-w-2xl font-display text-5xl font-bold leading-[1.02] text-navy md:text-6xl"
          />
          <TexteAccentue
            v-if="entete.texte"
            :texte="entete.texte"
            :vars="vars"
            as="p"
            class="mt-6 max-w-xl leading-relaxed text-ink/75"
          />
          <p v-if="offresStatus === 'success' && offres?.length" class="mt-4 text-sm font-medium text-ink/70">{{ compteur }}</p>
        </template>

        <EtatCollection
          class="mt-10"
          variant="lignes"
          :pending="offresStatus === 'pending'"
          :error="!!offresError"
          :empty="false"
          @retry="refreshOffres()"
        >
          <ul v-if="offres?.length" role="list" class="divide-y divide-border border-y border-border">
            <li v-for="offre in offres" :key="offre.uuid">
              <OffreLigne :offre="offre" />
            </li>
          </ul>
          <!-- État vide : titre + explication + action (libellés d'interface, jamais éditables). -->
          <div v-else class="max-w-xl border-y border-border py-12">
            <h2 class="font-display text-2xl font-semibold text-navy">{{ VIDE_TITRE }}</h2>
            <p class="mt-3 leading-relaxed text-ink/75">{{ VIDE_TEXTE }}</p>
            <NuxtLink
              :to="CANDIDATURE_SPONTANEE_PATH"
              class="mt-6 inline-flex min-h-12 items-center rounded-full bg-site-accent-strong px-7 text-sm font-semibold text-white transition-colors hover:bg-navy"
            >
              {{ VIDE_ACTION }}
            </NuxtLink>
          </div>
        </EtatCollection>
      </div>
    </section>

    <SectionCta v-if="cta" :cta="cta" :to="CANDIDATURE_SPONTANEE_PATH" :vars="vars" />
  </template>
</template>
