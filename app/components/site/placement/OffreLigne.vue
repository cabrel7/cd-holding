<script setup lang="ts">
// Une offre de la liste /placement/offres — une ligne, pas une carte (skill ui-ux règle 7 : pas
// de grille de cartes générique pour une simple liste). Titre/lieu/description viennent de
// `DemandeClient` (non éditables via le catalogue de sections, spec §1) : rendu en texte brut,
// jamais via TexteAccentue (réservé au contenu éditorial *accent*/\n du catalogue).
import { Banknote, Briefcase, MapPin } from '@lucide/vue'
import { TYPES_CONTRAT, offrePath } from '#shared/config/candidature'
import type { PublicOffreDto } from '#shared/types/public'

defineProps<{ offre: PublicOffreDto }>()
</script>

<template>
  <article class="grid gap-6 py-10 md:grid-cols-[1fr_auto] md:items-center">
    <div>
      <h2 class="font-display text-2xl font-semibold text-navy">{{ offre.titre }}</h2>
      <p class="mt-3 line-clamp-3 max-w-2xl leading-relaxed text-ink/75">{{ offre.description }}</p>
      <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
        <span class="inline-flex items-center gap-2">
          <MapPin :size="15" aria-hidden="true" class="text-site-accent-strong" />
          {{ offre.lieu }}
        </span>
        <span class="inline-flex items-center gap-2">
          <Briefcase :size="15" aria-hidden="true" class="text-site-accent-strong" />
          {{ TYPES_CONTRAT[offre.typeContrat] }}
        </span>
        <span v-if="offre.salaire" class="inline-flex items-center gap-2">
          <Banknote :size="15" aria-hidden="true" class="text-site-accent-strong" />
          {{ offre.salaire }}
        </span>
      </div>
    </div>
    <NuxtLink
      :to="offrePath(offre.uuid)"
      class="inline-flex min-h-11 items-center justify-self-start rounded-full bg-site-accent-strong px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy md:justify-self-end"
    >
      Postuler<span class="sr-only"> — {{ offre.titre }}</span>
    </NuxtLink>
  </article>
</template>
