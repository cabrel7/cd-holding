<script setup lang="ts">
// Candidats correspondants à une demande (calculés côté serveur : même catégorie, statut ≠ PLACE,
// anonymisés exclus, plafonnés). Chaque ligne peut être assignée à la demande.
import { UserPlus } from '@lucide/vue'
import type { AdminCorrespondantDto } from '#shared/types/admin'
import { Button } from '@/components/ui/button'
import { libellePoste } from '@/utils/placement'

defineProps<{
  correspondants: readonly AdminCorrespondantDto[]
  busy: boolean
}>()

const emit = defineEmits<{ assign: [candidatUuid: string] }>()
</script>

<template>
  <section class="space-y-2 border-t border-border pt-4" aria-label="Candidats correspondants">
    <h3 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Candidats correspondants</h3>
    <p v-if="correspondants.length === 0" class="text-sm text-muted-foreground">
      Aucun candidat disponible dans cette catégorie.
    </p>
    <ul v-else class="space-y-2">
      <li v-for="candidat in correspondants" :key="candidat.uuid" class="flex flex-wrap items-center justify-between gap-3">
        <span class="min-w-0 text-sm text-foreground">
          <span class="font-medium">{{ candidat.nomComplet ?? '—' }}</span>
          <span v-if="libellePoste(candidat.posteRecherche) !== '—'" class="text-muted-foreground">
            · {{ libellePoste(candidat.posteRecherche) }}
          </span>
          <span v-if="candidat.disponibilite" class="text-muted-foreground"> · {{ candidat.disponibilite }}</span>
        </span>
        <Button variant="outline" class="min-h-11 md:min-h-9" :disabled="busy" @click="emit('assign', candidat.uuid)">
          <UserPlus aria-hidden="true" />
          Assigner
        </Button>
      </li>
    </ul>
  </section>
</template>
