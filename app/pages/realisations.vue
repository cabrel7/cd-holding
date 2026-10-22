<script setup lang="ts">
// Dispatcher racine (spec lot 8, D4) : `/realisations` sert la holding (apex, mode chemin,
// tests) ou la filiale résolue par l'hôte. Imports synchrone → hydration stricte.
import HoldingRealisations from '@/site-pages/holding/realisations.vue'
import FilialeRealisations from '@/pages/[filiale]/realisations.vue'

const filialeSlug = useFilialeSlug()
</script>

<template>
  <component :is="filialeSlug ? FilialeRealisations : HoldingRealisations" />
</template>
