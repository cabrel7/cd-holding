<script setup lang="ts">
// Accueil filiale — spec lot1 §1 (« /{filiale} »), page validée par `isFilialeSlug` (même
// charpente que a-propos.vue). Un seul composant pour les 3 formes (standard, duo audiences ou
// métiers) : le duo s'affiche si `sections.audiences ?? sections.metiers` existe, aucun `if` par
// slug — seules les cibles de ses liens viennent de `FILIALE_DUO_LIENS` (spec §0, §4).
import { contactPath, FILIALE_DUO_LIENS, FILIALE_SLUGS, isFilialeSlug } from '#shared/config/sites'
import { cheminRelatif } from '#shared/utils/site-links'
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
  // Gate du mode chemin (spec lot 8, D4) : paramètre de route (forme préfixée) ou slug résolu
  // de l'hôte (forme nue sur un sous-domaine filiale). Un paramètre présent mais invalide reste
  // un 404 — on ne retombe jamais sur l'hôte.
  validate: (route) => {
    const param = route.params.filiale
    if (typeof param === 'string') return isFilialeSlug(param)
    const hote = useSiteHost().value.slug
    return hote !== undefined && isFilialeSlug(hote)
  },
})

// Résolu par l'hôte autant que par le paramètre : le dispatcher racine rend aussi ce composant
// (`<filiale>.localhost/` n'a aucun paramètre de route).
const slugCourant = useCurrentSiteSlug()
// `validate` garantit une filiale avant le rendu — repli jamais atteint (holding ne rend jamais
// cette page), il n'est là que pour satisfaire le type.
const slug = computed<FilialeSlug>(() => (isFilialeSlug(slugCourant.value) ? slugCourant.value : FILIALE_SLUGS[0]))

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
} = await useSiteCollection<PublicServiceDto, 'services'>(slug, 'services', { misEnAvant: true })
const {
  data: realisations,
  status: realisationsStatus,
  error: realisationsError,
  refresh: refreshRealisations,
} = await useSiteCollection<PublicRealisationDto, 'realisations'>(slug, 'realisations', { limit: APERCU_COLLECTION })

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? slug.value)

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const hero = computed(() => sections.value?.hero as HeroData | undefined)
const duo = computed(() => (sections.value?.audiences ?? sections.value?.metiers) as DuoData | undefined)
// Liens du duo et CTA traduits via siteHref (revue M3) : nu en sous-domaine, préfixé en chemin.
const { href } = useSiteLinks()
const duoLiens = computed(() => {
  const liens = FILIALE_DUO_LIENS[slug.value]
  if (!liens) return undefined
  return {
    ...liens,
    a: href(slug.value, cheminRelatif(slug.value, liens.a)).to,
    b: href(slug.value, cheminRelatif(slug.value, liens.b)).to,
  }
})
const lienContact = computed(() => href(slug.value, contactPath(slug.value)).to)
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
    <Button variant="outline" class="mt-4 min-h-11" @click="refreshSections()">Réessayer</Button>
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

    <SectionCta v-if="cta" :cta="cta" :to="lienContact" />
  </template>
</template>
