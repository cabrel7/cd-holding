<script setup lang="ts">
// Redirection vers la liste des dossiers clients (filiale unique du module comptable).
definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

onMounted(() => void navigateTo(toAdminPath('/admin/comptable/dossiers'), { replace: true }))
</script>

<template>
  <div />
</template>
