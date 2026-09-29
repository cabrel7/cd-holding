<script setup lang="ts">
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

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
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-8']">
    <header class="border-border space-y-6 border-b pb-6">
      <AdminPageHeader titre="Contenu des sites" />
      <nav class="flex flex-wrap gap-1" aria-label="Sections du contenu">
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
    </header>

    <NuxtPage />
  </div>
</template>
