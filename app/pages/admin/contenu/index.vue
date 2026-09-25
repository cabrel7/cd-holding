<script setup lang="ts">
// Sections éditoriales — sélecteur de site au niveau de la page (GET .../sections exige un
// site explicite pour SUPER_ADMIN, contrairement aux collections où le site se choisit dans
// CmsCollectionEditor lui-même, voir spec phase 2 §4.2/§4.5).
import { computed, ref, watch } from 'vue'
import type { SiteSlug } from '#shared/config/sites'
import type { AdminSiteSummary } from '#shared/types/admin'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import CmsSectionsEditor from '@/components/cms/CmsSectionsEditor.vue'

// Chaque page /admin/contenu/** déclare son propre meta (le meta du parent `contenu.vue`
// n'est pas hérité par les pages enfants dans le routage par fichiers de Nuxt).
definePageMeta({
  layout: false,
  middleware: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

const { data: sites, status } = await useFetch<AdminSiteSummary[]>('/api/admin/sites', {
  server: false,
  key: 'admin-sites',
  default: () => [] as AdminSiteSummary[],
})

const selectedSlug = ref<SiteSlug | undefined>(undefined)

watch(
  sites,
  (list) => {
    const stillValid = (list ?? []).some((s) => s.slug === selectedSlug.value)
    if (!stillValid) selectedSlug.value = list?.[0]?.slug
  },
  { immediate: true },
)

const selectedSite = computed<AdminSiteSummary | null>(() => (sites.value ?? []).find((s) => s.slug === selectedSlug.value) ?? null)

useHead({ title: 'Sections — Contenu des sites' })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="max-w-xl text-sm text-muted-foreground">
        Textes éditoriaux publiés sur le site sélectionné : en-têtes, appels à l'action, SEO, formulaires.
      </p>
      <Select
        v-if="(sites?.length ?? 0) > 1"
        :model-value="selectedSlug"
        @update:model-value="(v) => (selectedSlug = v as SiteSlug)"
      >
        <SelectTrigger class="w-56" aria-label="Site à gérer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="site in sites" :key="site.uuid" :value="site.slug">
            {{ site.nomCourt ?? site.nom }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="status === 'pending'" class="space-y-2">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-16 w-full" />
    </div>
    <p v-else-if="!selectedSite" class="text-sm text-muted-foreground">Aucun site accessible.</p>
    <CmsSectionsEditor v-else :site-slug="selectedSite.slug" :site-uuid="selectedSite.uuid" />
  </div>
</template>
