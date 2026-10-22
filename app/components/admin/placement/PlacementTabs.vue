<script setup lang="ts">
// Onglets-liens du module placement (même motif que la navigation de /admin/contenu) :
// trois routes distinctes, pas de Tabs piloté en JS. La route courante porte `aria-current`.
const route = useRoute()

const TABS = [
  { to: '/admin/placement/candidats', label: 'Candidats' },
  { to: '/admin/placement/demandes', label: 'Demandes' },
  { to: '/admin/placement/candidatures', label: 'Candidatures' },
] as const
</script>

<template>
  <nav class="flex flex-wrap gap-1" aria-label="Sections du placement">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors outline-hidden focus-visible:ring-2 md:min-h-9"
      :class="route.path === tab.to ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-card hover:text-navy'"
      :aria-current="route.path === tab.to ? 'page' : undefined"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>
