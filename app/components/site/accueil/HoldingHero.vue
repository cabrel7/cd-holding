<script setup lang="ts">
// Hero holding — spec phase 3 §4.2. Formes décoratives masquées sous `lg` : à 375/768 le blob
// navy du prototype recouvre le H1 (spec §0, angle mort 6), à 1440 il passe sous le header.
// Un seul CTA (skill ui-ux §1). Ni le H1 ni l'image ne sont en `v-motion` (LCP, contenu visible
// au SSR sans JS) — seuls surtitre/texte/CTA ont une entrée CSS `motion-safe`.
import { ArrowDownRight } from '@lucide/vue'
import { interpoler } from '#shared/utils/texte'
import type { HeroData } from '@/composables/useSiteSections'
import SiteImage from '@/components/site/SiteImage.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const NUMERO_PAD = 2

const props = defineProps<{
  hero: HeroData | undefined
  fallbackImageKey: string | null
  nombreFiliales: number
  groupe: string
}>()

const vars = computed(() => ({ groupe: props.groupe }))
const imageKey = computed(() => props.hero?.imageKey ?? props.fallbackImageKey)
const imageAlt = computed(() => interpoler(props.hero?.imageAlt ?? props.groupe, vars.value))
const badge = computed(() => String(props.nombreFiliales).padStart(NUMERO_PAD, '0'))
</script>

<template>
  <section class="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
    <svg
      class="pointer-events-none absolute -right-40 top-24 hidden h-[640px] w-[640px] opacity-90 lg:block"
      viewBox="0 0 600 600"
      aria-hidden="true"
    >
      <path
        class="fill-navy"
        d="M421.5,321.5Q403,393,338.5,432.5Q274,472,203.5,443.5Q133,415,101.5,347.5Q70,280,105,213.5Q140,147,207,116Q274,85,342,116.5Q410,148,428.5,214Q447,280,421.5,321.5Z"
      />
    </svg>
    <svg
      class="pointer-events-none absolute -right-20 top-64 hidden h-56 w-56 lg:block"
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="90" class="fill-gold" />
    </svg>

    <div v-if="hero" class="relative mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 lg:grid-cols-12 lg:items-center">
      <div class="lg:col-span-7">
        <TexteAccentue
          :texte="hero.surtitre"
          as="p"
          class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 font-display text-sm font-semibold uppercase tracking-[0.25em] text-gold-deep"
        />
        <TexteAccentue
          :texte="hero.titre"
          as="h1"
          class="mt-5 font-display text-4xl font-bold leading-[1.05] text-navy sm:text-5xl lg:text-7xl [&_em]:text-ink"
        />
        <TexteAccentue
          :texte="hero.texte"
          as="p"
          class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 mt-6 max-w-xl text-lg leading-relaxed text-ink/80"
        />
        <div class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 mt-10">
          <NuxtLink
            :to="{ hash: '#filiales' }"
            class="group inline-flex items-center gap-2 rounded-full bg-navy px-7 py-4 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
          >
            {{ hero.ctaLibelle ?? 'Découvrir nos filiales' }}
            <ArrowDownRight
              :size="18"
              aria-hidden="true"
              class="transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5"
            />
          </NuxtLink>
        </div>
      </div>

      <div class="relative lg:col-span-5">
        <div class="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-2xl lg:aspect-[4/5]">
          <SiteImage :file-key="imageKey" :alt="imageAlt" fallback="aplat" priority class="h-full w-full" />
          <div v-if="hero.legende" class="absolute inset-x-0 bottom-0 bg-navy p-6 text-cream">
            <p class="font-display text-xs uppercase tracking-widest text-gold">{{ hero.legende.surtitre }}</p>
            <p class="mt-1 font-display text-xl font-semibold">{{ hero.legende.titre }}</p>
          </div>
        </div>
        <div
          v-if="hero.badgeLibelle"
          class="absolute -left-6 -top-6 hidden rounded-2xl bg-cream p-5 shadow-xl ring-1 ring-border lg:block"
        >
          <p class="font-display text-4xl font-bold text-navy">{{ badge }}</p>
          <p class="mt-1 text-xs uppercase tracking-widest text-ink/70">{{ hero.badgeLibelle }}</p>
        </div>
      </div>
    </div>

    <!-- Ligne invalide omise par le serveur : la page garde toujours un H1 (spec §4.1). -->
    <div v-else class="relative mx-auto max-w-7xl px-6">
      <h1 class="font-display text-4xl font-bold text-navy sm:text-5xl lg:text-7xl">{{ groupe }}</h1>
    </div>
  </section>
</template>
