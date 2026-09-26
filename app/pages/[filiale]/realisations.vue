<script setup lang="ts">
// Réalisations — filiales (spec §1 « /{filiale}/realisations »). Page mince : tout le contenu
// (en-tête, grille, états, SEO) vit dans RealisationsListe, partagé avec `/realisations` holding.
import { isFilialeSlug } from '#shared/config/sites'
import RealisationsListe from '@/components/site/realisations/RealisationsListe.vue'

definePageMeta({
  validate: (route) => isFilialeSlug(String(route.params.filiale)),
})

const slug = useCurrentSiteSlug()
</script>

<template>
  <RealisationsListe :slug="slug" />
</template>
