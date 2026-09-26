<script setup lang="ts">
// Section "Nos filiales" (#filiales) — spec phase 3 §4.2. Chaque ligne porte son propre accent
// de marque (`data-accent-scope`, main.css) ; `couleurAccent` est revalidée côté serveur (hex
// strict) avant d'arriver ici, et le binding objet Vue échappe de toute façon la valeur.
import { ArrowUpRight } from '@lucide/vue'
import type { PublicSiteSummary } from '#shared/types/public'
import type { SectionData } from '@/composables/useSiteSections'
import EtatCollection from '@/components/site/EtatCollection.vue'
import SectionHeading from '@/components/site/SectionHeading.vue'
import SiteImage from '@/components/site/SiteImage.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const NUMERO_PAD = 2

const props = defineProps<{
  heading: SectionData | undefined
  filiales: readonly PublicSiteSummary[] | null
  pending: boolean
  error: boolean
}>()

defineEmits<{ retry: [] }>()

const { reveal } = useReveal()

const empty = computed(() => !props.pending && !props.error && !props.filiales?.length)

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => mot[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function numero(index: number): string {
  return String(index + 1).padStart(NUMERO_PAD, '0')
}

// Le texte d'introduction est rendu dans la colonne de droite (prototype) : l'en-tête de gauche
// ne reçoit que surtitre + titre, sinon le texte s'affiche deux fois.
const enTete = computed<SectionData | undefined>(() =>
  props.heading ? { ...props.heading, texte: undefined } : undefined,
)
</script>

<template>
  <section id="filiales" class="scroll-mt-24 py-24 md:py-32">
    <div class="mx-auto max-w-7xl px-6">
      <div class="grid grid-cols-1 items-end gap-8 md:grid-cols-12">
        <div class="md:col-span-7" style="--site-accent: var(--gold); --site-accent-strong: var(--gold-deep)">
          <SectionHeading v-if="enTete" :section="enTete" tone="clair" />
        </div>
        <TexteAccentue
          v-if="heading?.texte"
          :texte="heading.texte"
          as="p"
          class="leading-relaxed text-ink/75 md:col-span-5"
        />
      </div>

      <EtatCollection
        class="mt-20"
        :pending="pending"
        :error="error"
        :empty="empty"
        empty-message="Aucune filiale à afficher pour le moment."
        @retry="$emit('retry')"
      >
        <ol class="space-y-24">
          <li
            v-for="(f, index) in filiales"
            :key="f.uuid"
            v-motion
            v-bind="reveal(index)"
            data-accent-scope
            :style="{ '--site-accent': f.couleurAccent }"
            class="grid grid-cols-1 items-center gap-10 md:grid-cols-12"
          >
            <div :class="['md:col-span-7', index % 2 === 1 ? 'md:order-2' : '']">
              <div class="relative overflow-hidden rounded-[1.5rem]">
                <SiteImage
                  :file-key="f.heroImageKey"
                  :alt="f.nom"
                  fallback="aplat"
                  :initiales="initiales(f.nom)"
                  class="aspect-[4/3] w-full transition-transform duration-[900ms] hover:scale-105"
                />
                <div class="absolute inset-x-0 bottom-0 h-2 bg-site-accent" aria-hidden="true" />
              </div>
            </div>

            <div :class="['md:col-span-5', index % 2 === 1 ? 'md:order-1 md:pr-8' : 'md:pl-4']">
              <div class="flex items-center gap-3">
                <span class="font-display text-sm font-bold text-site-accent-strong">{{ numero(index) }}</span>
                <span class="h-px flex-1 bg-site-accent/40" aria-hidden="true" />
                <span class="text-xs uppercase tracking-widest text-ink/70">Filiale</span>
              </div>

              <h3 class="mt-4 font-display text-3xl font-bold leading-tight text-navy md:text-4xl">{{ f.nom }}</h3>
              <p v-if="f.secteur" class="mt-2 font-display text-sm font-medium text-site-accent-strong">
                {{ f.secteur }}
              </p>
              <p v-if="f.description" class="mt-5 leading-relaxed text-ink/75">{{ f.description }}</p>

              <NuxtLink
                :to="`/${f.slug}`"
                class="group mt-3 -mb-3 inline-flex min-h-11 items-center gap-2 py-3 font-display text-sm font-semibold text-navy"
              >
                <span class="border-b-2 border-site-accent pb-0.5 transition-colors">
                  Découvrir cette filiale
                  <span class="sr-only"> : {{ f.nom }}</span>
                </span>
                <ArrowUpRight
                  :size="18"
                  aria-hidden="true"
                  class="text-site-accent-strong transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </NuxtLink>
            </div>
          </li>
        </ol>
      </EtatCollection>
    </div>
  </section>
</template>
