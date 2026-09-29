<script setup lang="ts">
// Filtres de la liste des messages : site (si plusieurs), type, statut, recherche.
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { STATUT_MESSAGE_LABELS, TYPE_MESSAGE_LABELS } from '#shared/config/admin'
import type { AdminSiteSummary } from '#shared/types/admin'
import AdminFilterSelect from '../AdminFilterSelect.vue'
import AdminSearchInput from '../AdminSearchInput.vue'

const props = defineProps<{
  sites: readonly AdminSiteSummary[]
  site: string | undefined
  type: string | undefined
  statut: string | undefined
  hasFilters: boolean
}>()

const search = defineModel<string>('search', { required: true })

const emit = defineEmits<{
  'update:site': [value: string | undefined]
  'update:type': [value: string | undefined]
  'update:statut': [value: string | undefined]
  reset: []
}>()

const siteOptions = computed(() => props.sites.map((s) => ({ value: s.slug, label: s.nomCourt ?? s.nom })))
const typeOptions = Object.entries(TYPE_MESSAGE_LABELS).map(([value, label]) => ({ value, label }))
const statutOptions = Object.entries(STATUT_MESSAGE_LABELS).map(([value, label]) => ({ value, label }))
</script>

<template>
  <form class="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les messages" @submit.prevent>
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
      :model-value="type"
      label="Type"
      tout-label="Tous les types"
      :options="typeOptions"
      @update:model-value="(v) => emit('update:type', v)"
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
