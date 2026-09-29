<script setup lang="ts">
// Filtres de la liste des clients : recherche, site (si plusieurs), statut.
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { STATUT_CLIENT_LABELS } from '#shared/config/admin'
import type { AdminSiteSummary } from '#shared/types/admin'
import AdminFilterSelect from '../AdminFilterSelect.vue'
import AdminSearchInput from '../AdminSearchInput.vue'

const props = defineProps<{
  sites: readonly AdminSiteSummary[]
  site: string | undefined
  statut: string | undefined
  hasFilters: boolean
}>()

const search = defineModel<string>('search', { required: true })

const emit = defineEmits<{
  'update:site': [value: string | undefined]
  'update:statut': [value: string | undefined]
  reset: []
}>()

const siteOptions = computed(() => props.sites.map((s) => ({ value: s.slug, label: s.nomCourt ?? s.nom })))
const statutOptions = Object.entries(STATUT_CLIENT_LABELS).map(([value, label]) => ({ value, label }))
</script>

<template>
  <form class="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les clients" @submit.prevent>
    <AdminSearchInput v-model="search" label="Recherche" />
    <AdminFilterSelect
      v-if="sites.length > 1"
      :model-value="site"
      label="Site"
      tout-label="Tous les sites"
      :options="siteOptions"
      @update:model-value="(v) => emit('update:site', v)"
    />
    <AdminFilterSelect
      :model-value="statut"
      label="Statut"
      tout-label="Tous les statuts"
      :options="statutOptions"
      @update:model-value="(v) => emit('update:statut', v)"
    />
    <Button v-if="hasFilters" type="button" variant="ghost" class="min-h-11 md:min-h-9" @click="emit('reset')">
      Réinitialiser
    </Button>
  </form>
</template>
