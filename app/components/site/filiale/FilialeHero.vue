<script setup lang="ts">
// Hero d'accueil filiale — spec lot1 §1 (« /{filiale} »), modèle
// app/components/site/accueil/HoldingHero.vue. Layout 'image' (entretien, transport, comptable,
// boissons) : blob décoratif hidden lg:block (jamais superposé au H1 en mobile — écart du
// prototype SubHero corrigé, spec §0), image aside, CTA unique. Layout 'texte' (placement,
// ccdpaa : un duo existe) : pas d'image ni de CTA (le duo les porte, spec §1), aplat d'accent à
// droite sur lg à la place du blob. Ni le H1 ni l'image ne sont en `v-motion` (LCP).
import { ArrowRight } from '@lucide/vue'
import { contactPath } from '#shared/config/sites'
import type { FilialeSlug } from '#shared/config/sites'
import { interpoler } from '#shared/utils/texte'
import type { HeroData } from '@/composables/useSiteSections'
import SiteImage from '@/components/site/SiteImage.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const props = defineProps<{
  hero: HeroData | undefined
  fallbackImageKey: string | null
  nomCourt: string
  slug: FilialeSlug
  layout: 'image' | 'texte'
}>()

const siteVars = useSiteTextVars()
const imageKey = computed(() => props.hero?.imageKey ?? props.fallbackImageKey)
const imageAlt = computed(() => interpoler(props.hero?.imageAlt ?? props.nomCourt, siteVars.value))
</script>

<template>
  <section class="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
    <svg
      v-if="layout === 'image'"
      class="pointer-events-none absolute -left-32 top-24 hidden h-[520px] w-[520px] opacity-20 lg:block"
      viewBox="0 0 500 500"
      aria-hidden="true"
    >
      <path
        class="fill-site-accent"
        d="M414,289Q393,348,340,384Q287,420,224,417Q161,414,116,364Q71,314,79,246Q87,178,140,140Q193,102,254,105Q315,108,367,150Q419,192,421,241Q423,290,414,289Z"
      />
    </svg>
    <div
      v-else
      class="pointer-events-none absolute right-0 top-0 hidden h-full w-1/2 bg-site-accent/10 lg:block"
      aria-hidden="true"
    />

    <div
      v-if="hero"
      class="relative mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6"
      :class="layout === 'image' ? 'lg:grid-cols-12 lg:items-center' : ''"
    >
      <div :class="layout === 'image' ? 'lg:col-span-6' : 'max-w-3xl lg:max-w-[48%]'">
        <TexteAccentue
          :texte="hero.surtitre"
          as="p"
          class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
        />
        <TexteAccentue
          :texte="hero.titre"
          as="h1"
          class="mt-4 font-display text-5xl font-bold leading-[1.05] text-navy md:text-7xl"
        />
        <TexteAccentue
          :texte="hero.texte"
          as="p"
          class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 mt-6 max-w-2xl text-lg leading-relaxed text-ink/80"
        />
        <div
          v-if="layout === 'image'"
          class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 mt-10"
        >
          <NuxtLink
            :to="contactPath(slug)"
            class="group inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-7 py-4 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
          >
            {{ hero.ctaLibelle ?? 'Nous contacter' }}
            <ArrowRight
              :size="18"
              aria-hidden="true"
              class="transition-transform group-hover:translate-x-0.5"
            />
          </NuxtLink>
        </div>
      </div>

      <div v-if="layout === 'image'" class="relative lg:col-span-6">
        <div class="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl">
          <SiteImage
            :file-key="imageKey"
            :alt="imageAlt"
            fallback="aplat"
            :initiales="nomCourt.charAt(0)"
            priority
            class="h-full w-full"
          />
        </div>
      </div>
    </div>

    <!-- Ligne invalide omise par le serveur : la page garde toujours un H1 (comme HoldingHero). -->
    <div v-else class="relative mx-auto max-w-7xl px-6">
      <h1 class="font-display text-5xl font-bold text-navy md:text-7xl">{{ nomCourt }}</h1>
    </div>
  </section>
</template>
