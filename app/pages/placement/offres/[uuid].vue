<script setup lang="ts">
// Détail d'une offre + formulaire de candidature (spec docs/specs/lot3-pages-specifiques.md §4,
// écart assumé #1 : une page, pas un modal — le formulaire complet dépasse largement 85vh à
// 375px, le lien est partageable, et la page porte le JSON-LD JobPosting). 404 (fatal) si l'uuid
// est malformé (garde `validate`) ou si l'offre est absente/retirée/incomplète côté serveur.
import { ArrowLeft, Banknote, Briefcase, MapPin } from '@lucide/vue'
import { OFFRES_PATH, PLACEMENT_SLUG, TYPE_CONTRAT_SCHEMA_ORG, TYPES_CONTRAT } from '#shared/config/candidature'
import type { PublicOffreDto } from '#shared/types/public'
import type { FormulaireData } from '@/composables/useSiteSections'
import CandidatureForm from '@/components/site/placement/CandidatureForm.vue'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

definePageMeta({
  // Garde uuid (malformé → 404) + gate du mode chemin (spec lot 8, D4) : forme préfixée (mode
  // chemin, prod réécrit par Nginx) ou chemin nu servi sur `placement.<domaine>`.
  validate: (route) => {
    if (!UUID_PATTERN.test(String(route.params.uuid))) return false
    return route.path.startsWith(`/${PLACEMENT_SLUG}/`) || useSiteHost().value.slug === PLACEMENT_SLUG
  },
})

const route = useRoute()
const uuid = computed(() => String(route.params.uuid))
const slug = useCurrentSiteSlug()
const liens = useSiteLinks()

const { data: site } = await useSite(slug)
const { data: sections } = await useSiteSections(slug, 'OFFRES')

const { data: offre, error } = await useFetch<PublicOffreDto>(() => `/api/public/placement/offres/${uuid.value}`, {
  key: () => `placement-offre:${uuid.value}`,
})

if (error.value || !offre.value) {
  throw createError({ statusCode: error.value?.statusCode ?? 404, statusMessage: 'Offre introuvable', fatal: true })
}

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? 'Placement CD Pro')
const vars = computed(() => ({ nomCourt: nomCourt.value, nom: site.value?.nom }))
const candidatureSection = computed(() => sections.value?.candidature as FormulaireData | undefined)

useSeoMeta({
  title: () => `${offre.value?.titre ?? ''} — ${nomCourt.value}`,
  description: () => offre.value?.description.slice(0, 160) ?? '',
})

// JSON-LD JobPosting — jamais `entrepriseCliente` (le DTO public ne l'expose de toute façon
// pas) : l'organisme qui recrute affiché aux moteurs de recherche est toujours Placement CD Pro.
// Échappement `<` → `<` : évite qu'une valeur éditée injecte une balise dans le script inline.
useHead(() => {
  // D9 : `url` = canonique de l'offre (chemin nu sur l'hôte placement). `canonical` renvoie
  // null tant que l'hôte est inconnu (dev/e2e) — aucune URL absolue n'est alors émise.
  const lien = liens.canonical(route.path)
  const url = lien === null ? null : liens.absolute(PLACEMENT_SLUG, lien)
  return {
    script: offre.value
      ? [
          {
            type: 'application/ld+json',
            innerHTML: JSON.stringify({
              '@context': 'https://schema.org/',
              '@type': 'JobPosting',
              ...(url ? { url } : {}),
              title: offre.value.titre,
              description: offre.value.description,
              datePosted: offre.value.publieeLe,
              employmentType: TYPE_CONTRAT_SCHEMA_ORG[offre.value.typeContrat],
              hiringOrganization: { '@type': 'Organization', name: 'Placement CD Pro' },
              jobLocation: {
                '@type': 'Place',
                address: { '@type': 'PostalAddress', addressLocality: offre.value.lieu, addressCountry: 'CA' },
              },
            }).replace(/</g, '\\u003c'),
          },
        ]
      : [],
  }
})
</script>

<template>
  <section class="pb-24 pt-32 md:pb-32 md:pt-40">
    <div class="mx-auto max-w-5xl px-6">
      <NuxtLink
        :to="OFFRES_PATH"
        class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-site-accent-strong hover:underline"
      >
        <ArrowLeft :size="16" aria-hidden="true" />
        Retour aux offres
      </NuxtLink>

      <h1 class="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.05] text-navy md:text-5xl">
        {{ offre?.titre }}
      </h1>
      <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
        <span class="inline-flex items-center gap-2">
          <MapPin :size="15" aria-hidden="true" class="text-site-accent-strong" />
          {{ offre?.lieu }}
        </span>
        <span class="inline-flex items-center gap-2">
          <Briefcase :size="15" aria-hidden="true" class="text-site-accent-strong" />
          {{ offre ? TYPES_CONTRAT[offre.typeContrat] : '' }}
        </span>
        <span v-if="offre?.salaire" class="inline-flex items-center gap-2">
          <Banknote :size="15" aria-hidden="true" class="text-site-accent-strong" />
          {{ offre.salaire }}
        </span>
      </div>
      <p class="mt-6 max-w-2xl whitespace-pre-line leading-relaxed text-ink/80">{{ offre?.description }}</p>

      <div class="mt-14">
        <CandidatureForm
          :offre="offre ?? null"
          :section="candidatureSection"
          :vars="vars"
          :mention="site?.groupe.mentionFormulaires ?? null"
          :email-secours="site?.email ?? null"
        />
      </div>
    </div>
  </section>
</template>
