<script setup lang="ts">
// À propos — filiales (spec §4.3, prototype SubAboutPage.tsx). Même charpente éditoriale que
// la holding (histoire + équipe + partenaires), sans les repères chiffrés (catalogue A_PROPOS,
// portée 'filiales'). Le monogramme décoratif reprend l'aplat d'accent du prototype, sans le
// `radial-gradient` d'origine (CONVERSION_INVENTORY : dégradés interdits, CLAUDE.md §Design).
import { isFilialeSlug } from '#shared/config/sites'
import type { PublicMembreEquipeDto, PublicPartenaireDto } from '#shared/types/public'
import type { HistoireData, SectionData, SeoData } from '@/composables/useSiteSections'
import SectionHeading from '@/components/site/SectionHeading.vue'
import SiteImage from '@/components/site/SiteImage.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'
import EtatCollection from '@/components/site/EtatCollection.vue'
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

// Résolu aussi par l'hôte : le dispatcher racine rend ce composant sans paramètre de route
// (`<filiale>.localhost/a-propos`).
const slug = useCurrentSiteSlug()

const { data: site } = await useSite(slug)
const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(slug, 'A_PROPOS')
const {
  data: equipe,
  status: equipeStatus,
  error: equipeError,
  refresh: refreshEquipe,
} = await useSiteCollection<PublicMembreEquipeDto>(slug, 'equipe')
const {
  data: partenaires,
  status: partenairesStatus,
  error: partenairesError,
  refresh: refreshPartenaires,
} = await useSiteCollection<PublicPartenaireDto>(slug, 'partenaires')

const { reveal } = useReveal()

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? slug.value)
const vars = computed(() => ({ nomCourt: nomCourt.value, nom: site.value?.nom }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const histoire = computed(() => sections.value?.histoire as HistoireData | undefined)
const equipeHeading = computed(() => sections.value?.equipe as SectionData | undefined)
const partenairesHeading = computed(() => sections.value?.partenaires as SectionData | undefined)

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => mot[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

useSeoMeta({
  title: () => seo.value?.title ?? `À propos — ${nomCourt.value}`,
  description: () => seo.value?.description ?? `L'équipe et les partenaires de ${nomCourt.value}.`,
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <!-- Histoire -->
    <section class="pb-20 pt-32 md:pb-28 md:pt-40">
      <div class="mx-auto max-w-7xl px-6">
        <div v-if="!histoire" class="h-96 animate-pulse rounded-3xl bg-secondary" aria-hidden="true" />
        <div v-else class="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div class="md:col-span-7">
            <TexteAccentue
              :texte="histoire.surtitre"
              :vars="vars"
              as="p"
              class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
            />
            <TexteAccentue
              :texte="histoire.titre"
              :vars="vars"
              as="h1"
              class="mt-4 font-display text-5xl font-bold leading-[1.02] text-navy md:text-7xl"
            />
            <TexteAccentue
              v-for="(paragraphe, index) in histoire.paragraphes"
              :key="index"
              :texte="paragraphe"
              :vars="vars"
              as="p"
              class="mt-6 max-w-2xl text-lg leading-relaxed text-ink/80 first:mt-8"
            />
          </div>
          <div class="md:col-span-5">
            <SiteImage
              :file-key="null"
              :alt="nomCourt"
              fallback="aplat"
              :initiales="nomCourt.charAt(0)"
              class="aspect-square w-full rounded-[2rem]"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Équipe -->
    <section class="bg-navy py-24 text-cream md:py-28">
      <div class="mx-auto max-w-7xl px-6">
        <div class="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div class="md:col-span-4">
            <SectionHeading v-if="equipeHeading" :section="equipeHeading" tone="sombre" :vars="vars" />
          </div>
          <div class="md:col-span-8">
            <EtatCollection
              :pending="equipeStatus === 'pending'"
              :error="!!equipeError"
              :empty="equipeStatus === 'success' && !equipe?.length"
              empty-message="Aucun membre à afficher pour le moment."
              tone="sombre"
              @retry="refreshEquipe()"
            >
              <div class="space-y-8">
                <div
                  v-for="(membre, index) in equipe"
                  :key="membre.uuid"
                  v-motion
                  v-bind="reveal(index)"
                  class="grid grid-cols-12 items-center gap-5 border-t border-cream/15 pt-8"
                >
                  <div class="col-span-3 md:col-span-2">
                    <SiteImage
                      :file-key="membre.photoKey"
                      :alt="membre.nom"
                      fallback="initiales"
                      tone="sombre"
                      :initiales="initiales(membre.nom)"
                      :largeur-max="480"
                      class="aspect-square w-full rounded-full"
                    />
                  </div>
                  <div class="col-span-9 md:col-span-10">
                    <p class="text-xs uppercase tracking-widest text-cream/90">{{ membre.poste }}</p>
                    <h3 class="mt-1 font-display text-2xl font-bold">{{ membre.nom }}</h3>
                    <p v-if="membre.bio" class="mt-2 text-sm leading-relaxed text-cream/75">{{ membre.bio }}</p>
                  </div>
                </div>
              </div>
            </EtatCollection>
          </div>
        </div>
      </div>
    </section>

    <!-- Partenaires -->
    <section class="py-24 md:py-28">
      <div class="mx-auto max-w-7xl px-6">
        <SectionHeading v-if="partenairesHeading" :section="partenairesHeading" tone="clair" :vars="vars" />

        <EtatCollection
          class="mt-14"
          :pending="partenairesStatus === 'pending'"
          :error="!!partenairesError"
          :empty="partenairesStatus === 'success' && !partenaires?.length"
          empty-message="Aucun partenaire à afficher pour le moment."
          @retry="refreshPartenaires()"
        >
          <div class="flex flex-wrap items-center gap-x-10 gap-y-8">
            <div v-for="partenaire in partenaires" :key="partenaire.uuid" class="flex items-center gap-4">
              <SiteImage
                :file-key="partenaire.logoKey"
                :alt="partenaire.nom"
                fallback="initiales"
                :initiales="initiales(partenaire.nom)"
                :largeur-max="480"
                class="h-14 w-14 rounded-md"
              />
              <div>
                <p class="font-display text-base font-semibold text-navy">{{ partenaire.nom }}</p>
                <p v-if="partenaire.typeRelation" class="text-xs uppercase tracking-widest text-ink/70">
                  {{ partenaire.typeRelation }}
                </p>
              </div>
            </div>
          </div>
        </EtatCollection>
      </div>
    </section>
  </template>
</template>
