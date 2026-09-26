<script setup lang="ts">
// Réalisations — holding (spec §0 : absente du prototype mais liée depuis le header, DEC-39).
// Ne montre que les réalisations propres à la holding, pas un agrégat des filiales.
import { HOLDING_SLUG } from '#shared/config/sites'
import RealisationsListe from '@/components/site/realisations/RealisationsListe.vue'
</script>

<template>
  <RealisationsListe :slug="HOLDING_SLUG" />
</template>
