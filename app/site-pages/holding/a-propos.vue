<script setup lang="ts">
// À propos — holding (spec §4.3, prototype prototype_react/.../routes/a-propos.tsx).
// Histoire + repères (chiffres résolus) + équipe corporative + partenaires, tout éditable
// depuis l'admin (catalogue A_PROPOS, T4) — jamais de texte public en dur ici.
// Vit hors de `app/pages/` (lot 8, D4) : `app/pages/a-propos.vue` est le dispatcher qui choisit
// entre cette variante holding et `[filiale]/a-propos.vue` selon l'hôte.
import { HOLDING_SLUG } from '#shared/config/sites'
import type { PublicMembreEquipeDto, PublicPartenaireDto } from '#shared/types/public'
import type { ChiffresData, HistoireData, SectionData, SeoData } from '@/composables/useSiteSections'
import SectionHeading from '@/components/site/SectionHeading.vue'
import SiteImage from '@/components/site/SiteImage.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'
import EtatCollection from '@/components/site/EtatCollection.vue'
import { Button } from '@/components/ui/button'

const { data: site } = await useSite(HOLDING_SLUG)
const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(HOLDING_SLUG, 'A_PROPOS')
const {
  data: equipe,
  status: equipeStatus,
  error: equipeError,
  refresh: refreshEquipe,
} = await useSiteCollection<PublicMembreEquipeDto>(HOLDING_SLUG, 'equipe')
const {
  data: partenaires,
  status: partenairesStatus,
  error: partenairesError,
  refresh: refreshPartenaires,
} = await useSiteCollection<PublicPartenaireDto>(HOLDING_SLUG, 'partenaires')

const { reveal } = useReveal()

const groupe = computed(() => site.value?.groupe.nom ?? 'Groupe CD')
const vars = computed(() => ({ groupe: groupe.value }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const histoire = computed(() => sections.value?.histoire as HistoireData | undefined)
const reperes = computed(() => sections.value?.reperes as ChiffresData | undefined)
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
  title: () => seo.value?.title ?? 'À propos — Groupe CD',
  description: () => seo.value?.description ?? "L'histoire, l'équipe et les partenaires du Groupe CD.",
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <!-- Histoire & mission -->
    <section class="pb-20 pt-36 md:pb-28 md:pt-44">
      <div class="mx-auto max-w-7xl px-6">
        <div v-if="!histoire" class="h-96 animate-pulse rounded-3xl bg-secondary" aria-hidden="true" />
        <template v-else>
          <TexteAccentue
            :texte="histoire.surtitre"
            :vars="vars"
            as="p"
            class="font-display text-sm font-semibold uppercase tracking-[0.25em] text-gold-deep"
          />
          <TexteAccentue
            :texte="histoire.titre"
            :vars="vars"
            as="h1"
            class="mt-4 max-w-4xl font-display text-5xl font-bold leading-[1.02] text-navy md:text-7xl"
          />
          <div class="mt-14 grid grid-cols-1 gap-12 md:grid-cols-12">
            <div class="space-y-6 text-lg leading-relaxed text-ink/80 md:col-span-7">
              <TexteAccentue
                v-for="(paragraphe, index) in histoire.paragraphes"
                :key="index"
                :texte="paragraphe"
                :vars="vars"
                as="p"
              />
            </div>
            <aside v-if="reperes" class="rounded-3xl border border-border bg-white p-8 md:col-span-4 md:col-start-9">
              <TexteAccentue
                v-if="reperes.surtitre"
                :texte="reperes.surtitre"
                :vars="vars"
                as="p"
                class="font-display text-xs uppercase tracking-widest text-gold-deep"
              />
              <ul class="mt-4 space-y-4">
                <li v-for="(item, index) in reperes.items" :key="index">
                  <p class="font-display text-3xl font-bold text-navy">{{ item.valeur }}</p>
                  <p class="text-sm text-ink/70">{{ item.libelle }}</p>
                </li>
              </ul>
            </aside>
          </div>
        </template>
      </div>
    </section>

    <!-- Équipe — surtitres en or (brand holding, cf. spec §4.3 : hors filiale, l'accent
         est toujours l'or, indépendamment de l'accent de site injecté par le layout) -->
    <section
      class="bg-navy py-24 text-cream md:py-28"
      style="--site-accent: var(--gold); --site-accent-strong: var(--gold-deep)"
    >
      <div class="mx-auto max-w-7xl px-6">
        <div class="grid grid-cols-1 gap-10 md:grid-cols-12">
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
              <div class="grid grid-cols-1 gap-10 md:grid-cols-3">
                <figure
                  v-for="(membre, index) in equipe"
                  :key="membre.uuid"
                  v-motion
                  v-bind="reveal(index)"
                  :class="index === 1 ? 'md:mt-12' : ''"
                >
                  <div class="overflow-hidden rounded-[1.25rem]">
                    <SiteImage
                      :file-key="membre.photoKey"
                      :alt="membre.nom"
                      fallback="initiales"
                      tone="sombre"
                      :initiales="initiales(membre.nom)"
                      class="aspect-[4/5] w-full"
                    />
                  </div>
                  <figcaption class="mt-4">
                    <p class="text-xs uppercase tracking-widest text-gold">{{ membre.poste }}</p>
                    <p class="mt-1 font-display text-xl font-bold">{{ membre.nom }}</p>
                    <p v-if="membre.bio" class="mt-2 text-sm leading-relaxed text-cream/75">{{ membre.bio }}</p>
                  </figcaption>
                </figure>
              </div>
            </EtatCollection>
          </div>
        </div>
      </div>
    </section>

    <!-- Partenaires -->
    <section class="py-24 md:py-28">
      <div class="mx-auto max-w-7xl px-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div style="--site-accent: var(--gold); --site-accent-strong: var(--gold-deep)">
            <SectionHeading
              v-if="partenairesHeading"
              :section="{ surtitre: partenairesHeading.surtitre, titre: partenairesHeading.titre }"
              tone="clair"
              :vars="vars"
            />
          </div>
          <TexteAccentue
            v-if="partenairesHeading?.texte"
            :texte="partenairesHeading.texte"
            :vars="vars"
            as="p"
            class="max-w-md text-ink/70"
          />
        </div>

        <EtatCollection
          class="mt-14"
          :pending="partenairesStatus === 'pending'"
          :error="!!partenairesError"
          :empty="partenairesStatus === 'success' && !partenaires?.length"
          empty-message="Aucun partenaire à afficher pour le moment."
          @retry="refreshPartenaires()"
        >
          <ul class="divide-y divide-border border-y border-border">
            <li v-for="partenaire in partenaires" :key="partenaire.uuid" class="flex items-center gap-6 py-6">
              <SiteImage
                :file-key="partenaire.logoKey"
                :alt="partenaire.nom"
                fallback="initiales"
                :initiales="initiales(partenaire.nom)"
                class="h-16 w-16 rounded-md"
              />
              <div class="flex-1">
                <p class="font-display text-xl font-bold text-navy">{{ partenaire.nom }}</p>
                <p v-if="partenaire.typeRelation" class="mt-1 text-xs uppercase tracking-widest text-ink/70">
                  {{ partenaire.typeRelation }}
                </p>
              </div>
            </li>
          </ul>
        </EtatCollection>
      </div>
    </section>
  </template>
</template>
