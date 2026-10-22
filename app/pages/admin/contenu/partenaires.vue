<script setup lang="ts">
import CmsCollectionEditor from '@/components/cms/CmsCollectionEditor.vue'
import { partenairesConfig } from '@/config/cms-resources'

// Le meta est fusionné parent+enfant (Nuxt) : ne jamais déclarer `layout: false` ici, sinon
// l'enfant écrase le `layout: 'admin'` du parent `contenu.vue` et la sidebar disparaît.
definePageMeta({
  middleware: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Partenaires — Contenu des sites' })
</script>

<template>
  <CmsCollectionEditor :config="partenairesConfig" />
</template>
