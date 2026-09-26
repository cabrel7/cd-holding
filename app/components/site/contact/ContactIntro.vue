<script setup lang="ts">
// Colonne texte de /contact — réutilisable telle quelle par /{filiale}/contact (spec §4.4) :
// sans wrapper d'accent autour de ce composant, l'accent hérité (--site-accent) de la filiale
// s'applique directement au surtitre. Coordonnées masquées si absentes (aucun repli en dur —
// ne pas recopier la dette de SiteFooter.vue:58).
import { Mail, MapPin, Phone } from '@lucide/vue'
import type { TexteVars } from '#shared/utils/texte'
import type { FormulaireData } from '@/composables/useSiteSections'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

defineProps<{
  section: FormulaireData | undefined
  coordonnees: { email: string | null; telephone: string | null; adresse: string | null }
  vars: TexteVars
  /** H1 de repli si la section est absente/invalide : la page garde toujours un H1. */
  titreRepli: string
}>()
</script>

<template>
  <div>
    <p
      v-if="section?.surtitre"
      class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 font-display text-sm font-semibold uppercase tracking-[0.25em] text-site-accent-strong"
    >
      {{ section.surtitre }}
    </p>
    <TexteAccentue
      :texte="section?.titre ?? titreRepli"
      :vars="vars"
      as="h1"
      class="mt-4 font-display text-5xl font-bold leading-[1.05] text-navy lg:text-6xl"
    />
    <TexteAccentue
      v-if="section?.texte"
      :texte="section.texte"
      :vars="vars"
      as="p"
      class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 mt-6 max-w-md leading-relaxed text-ink/75"
    />
    <address
      v-if="coordonnees.email || coordonnees.telephone || coordonnees.adresse"
      class="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 mt-8 space-y-1 text-sm text-ink/70 not-italic"
    >
      <p v-if="coordonnees.email">
        <a :href="`mailto:${coordonnees.email}`" class="inline-flex min-h-11 items-center gap-2 py-2 hover:underline">
          <Mail :size="16" aria-hidden="true" />{{ coordonnees.email }}
        </a>
      </p>
      <p v-if="coordonnees.telephone">
        <a :href="`tel:${coordonnees.telephone}`" class="inline-flex min-h-11 items-center gap-2 py-2 hover:underline">
          <Phone :size="16" aria-hidden="true" />{{ coordonnees.telephone }}
        </a>
      </p>
      <p v-if="coordonnees.adresse" class="inline-flex min-h-11 items-center gap-2 py-2">
        <MapPin :size="16" aria-hidden="true" />{{ coordonnees.adresse }}
      </p>
    </address>
  </div>
</template>
