<script setup lang="ts">
// Réalisations — filiales (spec §1 « /{filiale}/realisations »). Page mince : tout le contenu
// (en-tête, grille, états, SEO) vit dans RealisationsListe, partagé avec `/realisations` holding.
import { isFilialeSlug } from '#shared/config/sites'
import RealisationsListe from '@/components/site/realisations/RealisationsListe.vue'

definePageMeta({
  // Gate du mode chemin (spec lot 8, D4) : paramètre de route (forme préfixée) ou slug résolu
  // de l'hôte. Un paramètre présent mais invalide reste un 404.
  validate: (route) => {
    const param = route.params.filiale
    if (typeof param === 'string') return isFilialeSlug(param)
    const hote = useSiteHost().value.slug
    return hote !== undefined && isFilialeSlug(hote)
  },
})

const slug = useCurrentSiteSlug()
</script>

<template>
  <RealisationsListe :slug="slug" />
</template>
