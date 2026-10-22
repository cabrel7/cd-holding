<script setup lang="ts">
// Mentions légales — filiales (catalogue MENTIONS_LEGALES, portée boissons ; spec
// lot7-mentions-legales.md). Hors prototype : ajout phase 2 (CMS, Q-07). `bypassMaintenance`
// comme /confidentialite (page légale lisible même en maintenance). Une filiale sans section
// `mentions` (aucune du catalogue sauf boissons) renvoie 404 — le pied de page ne lie cette
// page que pour les sites qui affichent la mention alcool.
import { isFilialeSlug } from '#shared/config/sites'
import type { LegalData, SeoData } from '@/composables/useSiteSections'
import TexteLegal from '@/components/site/legal/TexteLegal.vue'
import { Button } from '@/components/ui/button'

definePageMeta({
  bypassMaintenance: true,
  // Gate du mode chemin (spec lot 8, D4) : le chemin nu `/mentions-legales` n'existe que sur un
  // sous-domaine filiale — ailleurs, validate échoue → 404. Un paramètre présent mais invalide
  // reste un 404 (pas de repli sur l'hôte).
  validate: (route) => {
    const param = route.params.filiale
    if (typeof param === 'string') return isFilialeSlug(param)
    const hote = useSiteHost().value.slug
    return hote !== undefined && isFilialeSlug(hote)
  },
})

const slug = useCurrentSiteSlug()

const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(slug, 'MENTIONS_LEGALES')

const mentions = computed(() => sections.value?.mentions as LegalData | undefined)
const seo = computed(() => sections.value?.seo as SeoData | undefined)

if (!sectionsError.value && !mentions.value) {
  throw createError({ statusCode: 404, statusMessage: 'Introuvable', fatal: true })
}

useSeoMeta({
  title: () => seo.value?.title ?? mentions.value?.titre ?? 'Mentions légales',
  description: () => seo.value?.description ?? '',
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4 min-h-11" @click="refreshSections()">Réessayer</Button>
  </div>
  <TexteLegal v-else-if="mentions" :legal="mentions" />
</template>
