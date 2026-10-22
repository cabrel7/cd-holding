<script setup lang="ts">
// Planning hebdomadaire de la filiale CCDPAA : wrapper fin, la grille partagée
// (`PlanningView`) porte l'en-tête, la navigation de semaine et les dialogs.
import PlanningView from '@/components/admin/planning/PlanningView.vue'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'CCDPAA — Planning' })
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <PlanningView site="ccdpaa" />
  </div>
</template>
