<script setup lang="ts">
// Candidature spontanée (spec docs/specs/lot3-pages-specifiques.md §4, écart assumé #2 : route
// dédiée plutôt qu'une ancre sous la liste des offres — le formulaire est trop long pour tenir
// sous une simple ancre, et la règle du projet est « routes réelles, jamais d'ancre »).
import { interpoler } from '#shared/utils/texte'
import type { FormulaireData, SeoData } from '@/composables/useSiteSections'
import CandidatureForm from '@/components/site/placement/CandidatureForm.vue'
import { Button } from '@/components/ui/button'

const slug = useCurrentSiteSlug()
const { data: site } = await useSite(slug)
const { data: sections, error: sectionsError, refresh: refreshSections } = await useSiteSections(slug, 'OFFRES')

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? 'Placement CD Pro')
const vars = computed(() => ({ nomCourt: nomCourt.value, nom: site.value?.nom }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const spontanee = computed(() => sections.value?.spontanee as FormulaireData | undefined)

useSeoMeta({
  title: () => interpoler(seo.value?.title ?? `Candidature spontanée — ${nomCourt.value}`, vars.value),
  description: () =>
    interpoler(seo.value?.description ?? `Envoyez votre candidature spontanée à ${nomCourt.value}.`, vars.value),
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <section v-else class="pb-24 pt-32 md:pb-32 md:pt-40">
    <div class="mx-auto max-w-5xl px-6">
      <CandidatureForm
        :offre="null"
        :section="spontanee"
        :vars="vars"
        :mention="site?.groupe.mentionFormulaires ?? null"
        :email-secours="site?.email ?? null"
      />
    </div>
  </section>
</template>
