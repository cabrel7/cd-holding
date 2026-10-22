<script setup lang="ts">
// Redirection vers l'onglet par défaut des candidatures/vivier.
definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

onMounted(() => void navigateTo(toAdminPath('/admin/placement/candidats'), { replace: true }))
</script>

<template>
  <div />
</template>
