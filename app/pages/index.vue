<script setup lang="ts">
// Dispatcher racine (spec lot 8, D4) : `/` sert la holding (apex, mode chemin, tests) ou la
// filiale résolue par l'hôte (`<filiale>.localhost`, sous-domaine). Les deux variantes sont
// importées en synchrone : le composant rendu est strictement identique côté SSR et client.
import HoldingIndex from '@/site-pages/holding/index.vue'
import FilialeIndex from '@/pages/[filiale]/index.vue'

const filialeSlug = useFilialeSlug()
</script>

<template>
  <component :is="filialeSlug ? FilialeIndex : HoldingIndex" />
</template>
