<script setup lang="ts">
// Filtres des demandes : recherche, statut, état de publication.
import { Button } from '@/components/ui/button'
import { STATUT_DEMANDE_LABELS } from '#shared/config/admin'
import AdminFilterSelect from '../AdminFilterSelect.vue'
import AdminSearchInput from '../AdminSearchInput.vue'

defineProps<{
  statut: string | undefined
  publiee: string | undefined
  hasFilters: boolean
}>()

const search = defineModel<string>('search', { required: true })

const emit = defineEmits<{
  'update:statut': [value: string | undefined]
  'update:publiee': [value: string | undefined]
  reset: []
}>()

const statutOptions = Object.entries(STATUT_DEMANDE_LABELS).map(([value, label]) => ({ value, label }))
const publieeOptions = [
  { value: 'true', label: 'Publiées' },
  { value: 'false', label: 'Non publiées' },
]
</script>

<template>
  <form class="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les demandes" @submit.prevent>
    <AdminSearchInput v-model="search" label="Recherche" />
    <AdminFilterSelect
      :model-value="statut"
      label="Statut"
      tout-label="Tous les statuts"
      :options="statutOptions"
      @update:model-value="(v) => emit('update:statut', v)"
    />
    <AdminFilterSelect
      :model-value="publiee"
      label="Publication"
      tout-label="Toutes"
      :options="publieeOptions"
      @update:model-value="(v) => emit('update:publiee', v)"
    />
    <Button v-if="hasFilters" type="button" variant="ghost" class="min-h-11 md:min-h-9" @click="emit('reset')">
      Réinitialiser
    </Button>
  </form>
</template>
