<script setup lang="ts">
// Aperçu "Nos services" de l'accueil filiale (rangée numérotée), spec lot1 §1 : même mise en
// page pour les 6 filiales (placement/cdpaa compris, unifiés — spec §0 §4, pas de grille de
// cartes générique). Liste = jusqu'à 3 services mis en avant (API), repli défensif sur les 3
// premiers si le CMS en renvoie davantage.
import { ArrowRight } from '@lucide/vue'
import { APERCU_COLLECTION } from '#shared/config/public'
import type { FilialeSlug } from '#shared/config/sites'
import type { PublicServiceDto } from '#shared/types/public'
import type { SectionData } from '@/composables/useSiteSections'
import EtatCollection from '@/components/site/EtatCollection.vue'
import SectionHeading from '@/components/site/SectionHeading.vue'

const NUMERO_PAD = 2

const props = defineProps<{
  heading: SectionData | undefined
  services: PublicServiceDto[] | null
  pending: boolean
  error: boolean
  slug: FilialeSlug
}>()

defineEmits<{ retry: [] }>()

const { reveal } = useReveal()
const { href } = useSiteLinks()

const apercu = computed(() => props.services?.slice(0, APERCU_COLLECTION) ?? null)
const empty = computed(() => !props.pending && !props.error && !apercu.value?.length)

function numero(index: number): string {
  return String(index + 1).padStart(NUMERO_PAD, '0')
}
</script>

<template>
  <section class="py-24 md:py-28">
    <div class="mx-auto max-w-7xl px-6">
      <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading v-if="heading" :section="heading" tone="clair" class="max-w-xl" />
        <NuxtLink
          :to="href(props.slug, '/services').to"
          class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-navy hover:opacity-80"
        >
          Voir tous les services
          <ArrowRight :size="16" aria-hidden="true" />
        </NuxtLink>
      </div>

      <EtatCollection
        class="mt-14"
        :pending="pending"
        :error="error"
        :empty="empty"
        empty-message="Aucun service à afficher pour le moment."
        @retry="$emit('retry')"
      >
        <div class="space-y-10" role="list">
          <div
            v-for="(service, index) in apercu"
            role="listitem"
            :key="service.uuid"
            v-motion
            v-bind="reveal(index)"
            class="grid grid-cols-1 gap-6 border-t border-border pt-10 md:grid-cols-12"
          >
            <p class="font-display text-4xl font-bold text-site-accent-strong md:col-span-2">
              {{ numero(index) }}
            </p>
            <h3 class="font-display text-2xl font-bold text-navy md:col-span-6 md:text-3xl">
              {{ service.titre }}
            </h3>
            <p class="text-sm leading-relaxed text-ink/75 md:col-span-4">{{ service.description }}</p>
          </div>
        </div>
      </EtatCollection>
    </div>
  </section>
</template>
