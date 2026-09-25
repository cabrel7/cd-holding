<script setup lang="ts">
// Coquille des pages /admin/contenu/* : onglets-liens + en-tête minimal, tokens clairs, SANS
// shell de dashboard (point ouvert #11, spec phase 2 §6 — le vrai shell attend une décision
// de design encore ouverte). `<NuxtPage/>` rend la ressource sélectionnée (contenu/index.vue,
// services.vue, réalisations.vue, équipe.vue, partenaires.vue).
definePageMeta({
  layout: false,
  middleware: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

const route = useRoute()

const TABS = [
  { to: '/admin/contenu', label: 'Sections' },
  { to: '/admin/contenu/services', label: 'Services' },
  { to: '/admin/contenu/realisations', label: 'Réalisations' },
  { to: '/admin/contenu/equipe', label: 'Équipe' },
  { to: '/admin/contenu/partenaires', label: 'Partenaires' },
] as const

useHead({ title: 'Contenu des sites — Administration' })
</script>

<template>
  <main class="min-h-svh bg-cream px-6 py-10">
    <div class="mx-auto max-w-6xl space-y-10">
      <header class="border-b border-border pb-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-widest text-gold-deep">CMS</p>
            <h1 class="mt-2 font-display text-3xl font-semibold text-navy md:text-4xl">Contenu des sites</h1>
          </div>
          <NuxtLink to="/admin" class="text-sm text-muted-foreground hover:text-navy">← Tableau de bord</NuxtLink>
        </div>
        <nav class="mt-6 flex flex-wrap gap-1" aria-label="Sections du contenu">
          <NuxtLink
            v-for="tab in TABS"
            :key="tab.to"
            :to="tab.to"
            class="rounded-md px-3 py-1.5 text-sm transition-colors"
            :class="route.path === tab.to ? 'bg-navy text-white' : 'text-muted-foreground hover:bg-white hover:text-navy'"
          >
            {{ tab.label }}
          </NuxtLink>
        </nav>
      </header>

      <NuxtPage />
    </div>
  </main>
</template>
