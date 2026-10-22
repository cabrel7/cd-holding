<script setup lang="ts">
// Candidats assignés à une demande. Le retrait restaure le statut du candidat côté serveur
// (DISPONIBLE s'il n'est plus affecté ailleurs).
import { X } from '@lucide/vue'
import { formatDateQuebec } from '#shared/utils/dates'
import type { AdminAffectationDto } from '#shared/types/admin'
import { Button } from '@/components/ui/button'

defineProps<{
  affectations: readonly AdminAffectationDto[]
  busy: boolean
}>()

const emit = defineEmits<{ retire: [affectationUuid: string] }>()
</script>

<template>
  <section v-if="affectations.length > 0" class="space-y-2 border-t border-border pt-4" aria-label="Candidats affectés">
    <h3 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Candidats affectés</h3>
    <ul class="space-y-2">
      <li v-for="affectation in affectations" :key="affectation.uuid" class="flex flex-wrap items-center justify-between gap-3">
        <span class="min-w-0 text-sm text-foreground">
          <span class="font-medium">{{ affectation.nomCompletCandidat ?? '—' }}</span>
          <span class="text-muted-foreground"> · affecté le {{ formatDateQuebec(affectation.dateAffectation) }}</span>
        </span>
        <Button variant="outline" class="min-h-11 md:min-h-9" :disabled="busy" @click="emit('retire', affectation.uuid)">
          <X aria-hidden="true" />
          Retirer
        </Button>
      </li>
    </ul>
  </section>
</template>
