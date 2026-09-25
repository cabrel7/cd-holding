<script setup lang="ts">
import CmsCollectionEditor from '@/components/cms/CmsCollectionEditor.vue'
import { partenairesConfig } from '@/config/cms-resources'

// Chaque page /admin/contenu/** déclare son propre meta (non hérité du parent contenu.vue).
definePageMeta({
  layout: false,
  middleware: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Partenaires — Contenu des sites' })
</script>

<template>
  <CmsCollectionEditor :config="partenairesConfig" />
</template>
