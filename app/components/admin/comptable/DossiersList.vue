<script setup lang="ts">
// Dossiers clients : liste en lignes (structure du prototype admin.comptable.tsx) —
// pas de tableau. Ligne principale + ligne secondaire, badge statut, actions Modifier/Supprimer.
import { Pencil, Trash2 } from '@lucide/vue'
import { FORFAIT_COMPTABLE_LABELS, STATUT_DOSSIER_LABELS } from '#shared/config/admin'
import { formatDateLongue } from '#shared/utils/dates'
import type { AdminDossierComptableDto, StatutDossierDto } from '#shared/types/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

defineProps<{
  dossiers: readonly AdminDossierComptableDto[]
  busyUuid: string | null
}>()

const emit = defineEmits<{
  edit: [dossier: AdminDossierComptableDto]
  remove: [dossier: AdminDossierComptableDto]
}>()

// Mapping du prototype : A_JOUR → outline, EN_TRAITEMENT → secondary, EN_RETARD → default.
const STATUT_VARIANTS = {
  A_JOUR: 'outline',
  EN_TRAITEMENT: 'secondary',
  EN_RETARD: 'default',
} as const satisfies Record<StatutDossierDto, 'default' | 'secondary' | 'outline'>
</script>

<template>
  <ul class="divide-y divide-border border-y border-border">
    <li
      v-for="dossier in dossiers"
      :key="dossier.uuid"
      class="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center md:px-5"
      :aria-busy="busyUuid === dossier.uuid"
    >
      <div class="min-w-0">
        <p class="truncate font-medium text-foreground" :title="dossier.entreprise">{{ dossier.entreprise }}</p>
        <p class="mt-0.5 text-sm text-muted-foreground">
          <span class="break-all">{{ dossier.contact }}</span>
          · <span class="break-all">{{ dossier.email }}</span>
          · forfait {{ FORFAIT_COMPTABLE_LABELS[dossier.forfait].toLowerCase() }}
          · échéance {{ formatDateLongue(dossier.echeance) }}
        </p>
        <p v-if="dossier.notes" class="mt-1 break-words text-sm text-muted-foreground">{{ dossier.notes }}</p>
      </div>
      <div class="flex items-center gap-3">
        <Badge :variant="STATUT_VARIANTS[dossier.statut]">{{ STATUT_DOSSIER_LABELS[dossier.statut] }}</Badge>
        <Button
          variant="ghost"
          size="icon"
          class="size-11 md:size-9"
          :aria-label="`Modifier le dossier ${dossier.entreprise}`"
          :title="`Modifier le dossier ${dossier.entreprise}`"
          @click="emit('edit', dossier)"
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:size-9"
          :aria-label="`Supprimer le dossier ${dossier.entreprise}`"
          :title="`Supprimer le dossier ${dossier.entreprise}`"
          @click="emit('remove', dossier)"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  </ul>
</template>
