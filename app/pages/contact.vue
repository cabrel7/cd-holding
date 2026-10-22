<script setup lang="ts">
// Dispatcher racine (spec lot 8, D4) : `/contact` sert la holding (apex, mode chemin, tests)
// ou la filiale résolue par l'hôte. Imports synchrone → hydration stricte.
import HoldingContact from '@/site-pages/holding/contact.vue'
import FilialeContact from '@/pages/[filiale]/contact.vue'

const filialeSlug = useFilialeSlug()
</script>

<template>
  <component :is="filialeSlug ? FilialeContact : HoldingContact" />
</template>
