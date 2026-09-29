<script setup lang="ts">
// Coquille des pages /admin/contenu/* : titre + onglets-liens dans le shell admin. `<NuxtPage/>`
// rend la ressource sélectionnée (contenu/index.vue, services.vue, réalisations.vue, équipe.vue,
// partenaires.vue).
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

const route = useRoute()

const TABS = [
  { to: '/admin/contenu', label: 'Sections' },
  { to: '/admin/contenu/site', label: 'Site' },
  { to: '/admin/contenu/services', label: 'Services' },
  { to: '/admin/contenu/realisations', label: 'Réalisations' },
  { to: '/admin/contenu/equipe', label: 'Équipe' },
  { to: '/admin/contenu/partenaires', label: 'Partenaires' },
] as const

useHead({ title: 'Contenu des sites — Administration' })
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-8">
    <header class="border-border border-b pb-6">
      <h1 class="font-display text-navy text-3xl font-semibold">Contenu des sites</h1>
      <nav class="mt-6 flex flex-wrap gap-1" aria-label="Sections du contenu">
        <NuxtLink
          v-for="tab in TABS"
          :key="tab.to"
          :to="tab.to"
          class="focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors outline-hidden focus-visible:ring-2 md:min-h-9"
          :class="route.path === tab.to ? 'bg-navy text-white' : 'text-muted-foreground hover:bg-card hover:text-navy'"
          :aria-current="route.path === tab.to ? 'page' : undefined"
        >
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </header>

    <NuxtPage />
  </div>
</template>
