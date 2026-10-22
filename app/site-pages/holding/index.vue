<script setup lang="ts">
// Accueil holding — spec phase 3 (docs/specs/phase3-holding-home.md §4), prototype
// prototype_react/.../routes/index.tsx + components/holding/{Hero,Companies,Stats}.tsx.
// Hero + filiales + chiffres + CTA final, tout éditable depuis l'admin (catalogue ACCUEIL) —
// jamais de texte public en dur ici.
// Vit hors de `app/pages/` (lot 8, D4) : `app/pages/index.vue` est le dispatcher qui choisit
// entre cette variante holding et `[filiale]/index.vue` selon l'hôte.
import { contactPath, HOLDING_SLUG } from '#shared/config/sites'
import { interpoler } from '#shared/utils/texte'
import type { ChiffresData, CtaData, HeroData, SectionData, SeoData } from '@/composables/useSiteSections'
import HoldingHero from '@/components/site/accueil/HoldingHero.vue'
import HoldingFiliales from '@/components/site/accueil/HoldingFiliales.vue'
import HoldingChiffres from '@/components/site/accueil/HoldingChiffres.vue'
import SectionCta from '@/components/site/SectionCta.vue'
import { Button } from '@/components/ui/button'

const { data: site } = await useSite(HOLDING_SLUG)
const { data: filiales, status: filialesStatus, error: filialesError, refresh: refreshFiliales } = useSites()
const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(HOLDING_SLUG, 'ACCUEIL')

const groupe = computed(() => site.value?.groupe.nom ?? 'Groupe CD')
const vars = computed(() => ({ groupe: groupe.value }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const hero = computed(() => sections.value?.hero as HeroData | undefined)
const filialesHeading = computed(() => sections.value?.filiales as SectionData | undefined)
const chiffres = computed(() => sections.value?.chiffres as ChiffresData | undefined)
const cta = computed(() => sections.value?.cta as CtaData | undefined)

const nombreFiliales = computed(() => filiales.value?.length ?? 0)

useSeoMeta({
  title: () => interpoler(seo.value?.title ?? `${groupe.value} — Holding montréalaise`, vars.value),
  description: () => interpoler(seo.value?.description ?? site.value?.description ?? '', vars.value),
  ogTitle: () => interpoler(seo.value?.title ?? groupe.value, vars.value),
  ogDescription: () => interpoler(seo.value?.description ?? site.value?.description ?? '', vars.value),
  ogType: 'website',
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <HoldingHero :hero="hero" :fallback-image-key="site?.heroImageKey ?? null" :nombre-filiales="nombreFiliales" :groupe="groupe" />
    <HoldingFiliales
      :heading="filialesHeading"
      :filiales="filiales ?? null"
      :pending="filialesStatus === 'pending'"
      :error="!!filialesError"
      @retry="refreshFiliales()"
    />
    <HoldingChiffres v-if="chiffres" :chiffres="chiffres" />
    <SectionCta v-if="cta" :cta="cta" :to="contactPath(HOLDING_SLUG)" />
  </template>
</template>
