<script setup lang="ts">
// Réalisations — holding (spec §0 : absente du prototype mais liée depuis le header, DEC-39).
// Ne montre que les réalisations propres à la holding, pas un agrégat des filiales.
// Vit hors de `app/pages/` (lot 8, D4) : `app/pages/realisations.vue` est le dispatcher qui choisit
// entre cette variante holding et `[filiale]/realisations.vue` selon l'hôte.
import { HOLDING_SLUG } from '#shared/config/sites'
import RealisationsListe from '@/components/site/realisations/RealisationsListe.vue'
</script>

<template>
  <RealisationsListe :slug="HOLDING_SLUG" />
</template>
