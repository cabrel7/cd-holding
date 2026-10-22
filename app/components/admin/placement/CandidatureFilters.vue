<script setup lang="ts">
// Filtres des candidatures : recherche, statut.
import { Button } from '@/components/ui/button'
import { STATUT_CANDIDATURE_LABELS } from '#shared/config/admin'
import AdminFilterSelect from '../AdminFilterSelect.vue'
import AdminSearchInput from '../AdminSearchInput.vue'

defineProps<{
  statut: string | undefined
  hasFilters: boolean
}>()

const search = defineModel<string>('search', { required: true })

const emit = defineEmits<{
  'update:statut': [value: string | undefined]
  reset: []
}>()

const statutOptions = Object.entries(STATUT_CANDIDATURE_LABELS).map(([value, label]) => ({ value, label }))
</script>

<template>
  <form class="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les candidatures" @submit.prevent>
    <AdminSearchInput v-model="search" label="Recherche" />
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
