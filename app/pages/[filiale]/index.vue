<script setup lang="ts">
// Accueil filiale — spec lot1 §1 (« /{filiale} »), page validée par `isFilialeSlug` (même
// charpente que a-propos.vue). Un seul composant pour les 3 formes (standard, duo audiences ou
// métiers) : le duo s'affiche si `sections.audiences ?? sections.metiers` existe, aucun `if` par
// slug — seules les cibles de ses liens viennent de `FILIALE_DUO_LIENS` (spec §0, §4).
import { contactPath, FILIALE_DUO_LIENS, isFilialeSlug } from '#shared/config/sites'
import type { FilialeSlug } from '#shared/config/sites'
import { APERCU_COLLECTION } from '#shared/config/public'
import type { PublicRealisationDto, PublicServiceDto } from '#shared/types/public'
import type { CtaData, DuoData, HeroData, SeoData, SectionData } from '@/composables/useSiteSections'
import FilialeHero from '@/components/site/filiale/FilialeHero.vue'
import FilialeDuo from '@/components/site/filiale/FilialeDuo.vue'
import FilialeServicesApercu from '@/components/site/filiale/FilialeServicesApercu.vue'
import FilialeRealisationsApercu from '@/components/site/filiale/FilialeRealisationsApercu.vue'
import SectionCta from '@/components/site/SectionCta.vue'
import { Button } from '@/components/ui/button'

definePageMeta({
  validate: (route) => isFilialeSlug(String(route.params.filiale)),
})

const route = useRoute()
// Validé par `definePageMeta.validate` ci-dessus : le paramètre est toujours un FilialeSlug ici.
const slug = computed<FilialeSlug>(() => String(route.params.filiale) as FilialeSlug)

const { data: site } = await useSite(slug)
const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(slug, 'ACCUEIL')
const {
  data: services,
  status: servicesStatus,
  error: servicesError,
  refresh: refreshServices,
} = await useSiteCollection<PublicServiceDto>(slug, 'services', { misEnAvant: true, limit: APERCU_COLLECTION })
const {
  data: realisations,
  status: realisationsStatus,
  error: realisationsError,
  refresh: refreshRealisations,
} = await useSiteCollection<PublicRealisationDto>(slug, 'realisations', { limit: APERCU_COLLECTION })

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? String(route.params.filiale))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const hero = computed(() => sections.value?.hero as HeroData | undefined)
const duo = computed(() => (sections.value?.audiences ?? sections.value?.metiers) as DuoData | undefined)
const duoLiens = computed(() => FILIALE_DUO_LIENS[slug.value])
const servicesHeading = computed(() => sections.value?.services as SectionData | undefined)
const realisationsHeading = computed(() => sections.value?.realisations as SectionData | undefined)
const cta = computed(() => sections.value?.cta as CtaData | undefined)

useSeoMeta({
  title: () => seo.value?.title ?? nomCourt.value,
  description: () => seo.value?.description ?? site.value?.description ?? undefined,
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <FilialeHero
      :hero="hero"
      :fallback-image-key="site?.heroImageKey ?? null"
      :nom-court="nomCourt"
      :slug="slug"
      :layout="duo ? 'texte' : 'image'"
    />

    <FilialeDuo v-if="duo && duoLiens" :duo="duo" :liens="{ a: duoLiens.a, b: duoLiens.b }" />

    <FilialeServicesApercu
      :heading="servicesHeading"
      :services="services ?? null"
      :pending="servicesStatus === 'pending'"
      :error="!!servicesError"
      :slug="slug"
      @retry="refreshServices()"
    />

    <FilialeRealisationsApercu
      :heading="realisationsHeading"
      :realisations="realisations ?? null"
      :pending="realisationsStatus === 'pending'"
      :error="!!realisationsError"
      :slug="slug"
      @retry="refreshRealisations()"
    />

    <SectionCta v-if="cta" :cta="cta" :to="contactPath(slug)" />
  </template>
</template>
