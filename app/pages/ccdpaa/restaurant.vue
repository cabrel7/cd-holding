<script setup lang="ts">
// Restaurant — ccdpaa (spec lot3 §1/§4, prototype ccdpaa.restaurant.tsx). Route dédiée (pas
// `[filiale]/restaurant.vue`) : cette page n'existe que pour ccdpaa (DEC workflow lot3 §1, pages
// spécifiques). Horaires et adresse viennent uniquement de `ReglagesRestaurant` (GET
// /api/public/restaurant) — jamais en dur (écart assumé au prototype, qui les codait en dur).
import type { FormulaireData, HeroData, SeoData } from '@/composables/useSiteSections'
import type { PublicRestaurantDto } from '#shared/types/public'
import { libelleHeure, libelleJoursOuverture } from '#shared/utils/restaurant'
import SiteImage from '@/components/site/SiteImage.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'
import ReservationForm from '@/components/site/restaurant/ReservationForm.vue'
import { Button } from '@/components/ui/button'

/** Type catalogue `galerie` (RESTAURANT:menu), miroir de `galerieSchema` (shared/content/sections/types.ts). */
interface GalerieItemData {
  readonly titre: string
  readonly sousTitre?: string
  readonly imageKey?: string | null
  readonly imageAlt?: string
}
interface GalerieData {
  readonly surtitre?: string
  readonly titre: string
  readonly items: readonly GalerieItemData[]
}

const slug = useCurrentSiteSlug()

const { data: site } = await useSite(slug)
const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(slug, 'RESTAURANT')
const { data: reglages } = await useFetch<PublicRestaurantDto>('/api/public/restaurant', {
  key: 'restaurant-reglages',
})

const nomCourt = computed(() => site.value?.nomCourt ?? site.value?.nom ?? 'CCDPAA')
const vars = computed(() => ({ nomCourt: nomCourt.value, nom: site.value?.nom }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const hero = computed(() => sections.value?.hero as HeroData | undefined)
const menu = computed(() => sections.value?.menu as GalerieData | undefined)
const reservationSection = computed(() => sections.value?.reservation as FormulaireData | undefined)

const heureOuverture = computed(() =>
  reglages.value ? `${libelleHeure(reglages.value.heureOuverture)} · ${libelleHeure(reglages.value.heureFermeture)}` : '',
)
const joursOuverture = computed(() => (reglages.value ? libelleJoursOuverture(reglages.value.joursOuverture) : ''))
// `tel:` sans espaces ni séparateurs (le numéro affiché garde le format saisi dans les réglages).
const telephoneHref = computed(() => (site.value?.telephone ?? '').replace(/[^\d+]/g, ''))
const adresse = computed(() => reglages.value?.adresse ?? reglages.value?.quartier ?? null)

useSeoMeta({
  title: () => seo.value?.title ?? `Restaurant — ${nomCourt.value}`,
  description: () => seo.value?.description ?? site.value?.description ?? undefined,
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4 min-h-11" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <!-- Hero -->
    <section class="pb-20 pt-32 md:pb-24 md:pt-40">
      <div class="mx-auto max-w-7xl px-6">
        <div v-if="!hero" class="h-96 animate-pulse rounded-3xl bg-secondary" aria-hidden="true" />
        <div v-else class="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div class="min-w-0 break-words md:col-span-7">
            <TexteAccentue
              v-if="hero.surtitre"
              :texte="hero.surtitre"
              :vars="vars"
              as="p"
              class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
            />
            <TexteAccentue
              :texte="hero.titre"
              :vars="vars"
              as="h1"
              class="mt-4 font-display text-5xl font-bold leading-[1.02] text-navy md:text-6xl lg:text-7xl"
            />
            <TexteAccentue
              :texte="hero.texte"
              :vars="vars"
              as="p"
              class="mt-6 max-w-xl text-lg leading-relaxed text-ink/80"
            />

            <div class="mt-8 grid max-w-md grid-cols-2 gap-8">
              <div v-if="reglages">
                <p class="font-display text-xs uppercase tracking-widest text-ink/70">Ouverture</p>
                <p class="mt-1 font-semibold text-navy">{{ joursOuverture }}<br>{{ heureOuverture }}</p>
              </div>
              <div v-if="reglages && adresse">
                <p class="font-display text-xs uppercase tracking-widest text-ink/70">Adresse</p>
                <p class="mt-1 font-semibold text-navy">{{ adresse }}</p>
              </div>
            </div>
          </div>
          <div class="md:col-span-5">
            <SiteImage
              :file-key="hero.imageKey ?? site?.heroImageKey ?? null"
              :alt="hero.imageAlt || 'Salle du restaurant'"
              fallback="aplat"
              :initiales="nomCourt.charAt(0)"
              priority
              class="aspect-[4/5] w-full rounded-[2rem] shadow-xl"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Menu -->
    <section v-if="menu" class="py-20 md:py-28">
      <div class="mx-auto max-w-7xl px-6">
        <TexteAccentue
          v-if="menu.surtitre"
          :texte="menu.surtitre"
          :vars="vars"
          as="p"
          class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
        />
        <TexteAccentue
          :texte="menu.titre"
          :vars="vars"
          as="h2"
          class="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.05] text-navy md:text-5xl"
        />

        <div class="mt-14 grid grid-cols-1 gap-8 md:grid-cols-4">
          <article
            v-for="(item, index) in menu.items"
            :key="item.titre"
            :class="index % 2 === 1 ? 'md:mt-10' : undefined"
          >
            <SiteImage
              :file-key="item.imageKey ?? null"
              :alt="item.imageAlt || item.titre"
              fallback="aplat"
              :initiales="item.titre.charAt(0)"
              class="aspect-square w-full rounded-2xl"
            />
            <p v-if="item.sousTitre" class="mt-4 text-xs uppercase tracking-widest text-site-accent-strong">
              {{ item.sousTitre }}
            </p>
            <h3 class="mt-1 font-display text-xl font-bold text-navy">{{ item.titre }}</h3>
          </article>
        </div>
      </div>
    </section>

    <!-- Réservation -->
    <ReservationForm
      v-if="reglages"
      :section="reservationSection"
      :reglages="reglages"
      :vars="vars"
      :mention="site?.groupe.mentionFormulaires ?? null"
      :email-secours="site?.email ?? null"
    />
    <section v-else class="pb-24 md:pb-32">
      <div class="mx-auto max-w-4xl px-6">
        <p class="text-ink/70">
          Réservez par téléphone
          <template v-if="site?.telephone">
            au
            <a :href="`tel:${telephoneHref}`" class="font-semibold underline underline-offset-2 hover:text-site-accent-strong">{{ site.telephone }}</a>
          </template>
          ou via la
          <NuxtLink to="/ccdpaa/contact" class="underline underline-offset-2 hover:text-site-accent-strong">page contact</NuxtLink>.
        </p>
      </div>
    </section>
  </template>
</template>
