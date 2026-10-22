<script setup lang="ts">
// Filtres de la liste des comptes : recherche, rôle, statut (miroir de `ClientFilters`).
import { ROLE_LABELS, STATUT_COMPTE_LABELS } from '#shared/config/admin'
import { Button } from '@/components/ui/button'
import AdminFilterSelect from '../AdminFilterSelect.vue'
import AdminSearchInput from '../AdminSearchInput.vue'

defineProps<{
  role: string | undefined
  actif: string | undefined
  hasFilters: boolean
}>()

const search = defineModel<string>('search', { required: true })

const emit = defineEmits<{
  'update:role': [value: string | undefined]
  'update:actif': [value: string | undefined]
  reset: []
}>()

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))
// Valeurs du schéma partagé `actif` ('true'/'false') — PAS les clés de STATUT_COMPTE_LABELS
// ('actif'/'inactif') : `useAdminListQuery` invaliderait silencieusement la clé et le filtre
// serait un no-op. Miroir ClientFilters, où les clés du Record sont déjà les valeurs du schéma.
const statutOptions = [
  { value: 'true', label: STATUT_COMPTE_LABELS.actif },
  { value: 'false', label: STATUT_COMPTE_LABELS.inactif },
]
</script>

<template>
  <form class="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les comptes" @submit.prevent>
    <AdminSearchInput v-model="search" label="Recherche" />
    <AdminFilterSelect
      :model-value="role"
      label="Rôle"
      tout-label="Tous les rôles"
      :options="roleOptions"
      @update:model-value="(v) => emit('update:role', v)"
    />
    <AdminFilterSelect
      :model-value="actif"
      label="Statut"
      tout-label="Tous les statuts"
      :options="statutOptions"
      @update:model-value="(v) => emit('update:actif', v)"
    />
    <Button v-if="hasFilters" type="button" variant="ghost" class="min-h-11 md:min-h-9" @click="emit('reset')">
      Réinitialiser
    </Button>
  </form>
</template>
