<script setup lang="ts">
// Dispatcher racine (spec lot 8, D4) : `/a-propos` sert la holding (apex, mode chemin, tests)
// ou la filiale résolue par l'hôte. Imports synchrone → hydration stricte.
import HoldingAPropos from '@/site-pages/holding/a-propos.vue'
import FilialeAPropos from '@/pages/[filiale]/a-propos.vue'

const filialeSlug = useFilialeSlug()
</script>

<template>
  <component :is="filialeSlug ? FilialeAPropos : HoldingAPropos" />
</template>
