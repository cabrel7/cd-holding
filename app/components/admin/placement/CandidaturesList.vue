<script setup lang="ts">
// Candidatures reçues : liste d'articles. Une candidature anonymisée n'affiche plus aucune PII ni
// document, seulement sa date d'anonymisation — elle reste supprimable.
import { CATEGORIE_POSTE_LABELS, STATUT_CANDIDATURE_LABELS } from '#shared/config/admin'
import { NIVEAUX_EXPERIENCE } from '#shared/config/candidature'
import { formatDateQuebec } from '#shared/utils/dates'
import type { AdminCandidatureDto, StatutCandidatureDto } from '#shared/types/admin'
import { libellePoste } from '@/utils/placement'
import { Badge } from '@/components/ui/badge'
import CandidatureActions from './CandidatureActions.vue'
import CandidatureDetail from './CandidatureDetail.vue'
import InlineStatutSelect from './InlineStatutSelect.vue'

const props = defineProps<{
  candidatures: readonly AdminCandidatureDto[]
  busyUuid: string | null
}>()

const emit = defineEmits<{
  statut: [candidature: AdminCandidatureDto, statut: StatutCandidatureDto]
  vivier: [candidature: AdminCandidatureDto]
  anonymiser: [candidature: AdminCandidatureDto]
  remove: [candidature: AdminCandidatureDto]
}>()

const STATUT_VARIANTS = {
  NOUVELLE: 'secondary',
  EN_REVISION: 'outline',
  RETENUE: 'default',
  REJETEE: 'destructive',
} as const satisfies Record<StatutCandidatureDto, 'secondary' | 'outline' | 'default' | 'destructive'>

const statutOptions = Object.entries(STATUT_CANDIDATURE_LABELS).map(([value, label]) => ({ value, label }))

const busy = (uuid: string): boolean => props.busyUuid === uuid
</script>

<template>
  <div class="divide-y divide-border border-y border-border">
    <article v-for="candidature in candidatures" :key="candidature.uuid" class="space-y-4 py-5" :aria-busy="busy(candidature.uuid)">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="candidature.anonymiseLe !== null">
              <h2 class="text-base font-semibold text-muted-foreground">Candidature anonymisée</h2>
              <span class="text-sm text-muted-foreground">{{ formatDateQuebec(candidature.anonymiseLe) }}</span>
            </template>
            <template v-else>
              <h2 class="text-base font-semibold text-foreground">{{ candidature.nomComplet ?? '—' }}</h2>
              <Badge :variant="STATUT_VARIANTS[candidature.statut]">{{ STATUT_CANDIDATURE_LABELS[candidature.statut] }}</Badge>
            </template>
          </div>
          <p v-if="candidature.anonymiseLe === null" class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span class="font-medium text-foreground">{{ libellePoste(candidature.posteRecherche, candidature.posteAutrePrecision) }}</span>
            <span aria-hidden="true">·</span>
            <Badge variant="secondary">{{ CATEGORIE_POSTE_LABELS[candidature.categorie] }}</Badge>
            <span>{{ candidature.offreTitre ? `Offre « ${candidature.offreTitre} »` : 'Candidature spontanée' }}</span>
          </p>
          <p v-if="candidature.anonymiseLe === null" class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <template v-if="candidature.experience">
              <span>Expérience : {{ NIVEAUX_EXPERIENCE.find((n) => n.value === candidature.experience)?.label ?? candidature.experience }}</span>
              <span aria-hidden="true">·</span>
            </template>
            <template v-if="candidature.pays">
              <span>{{ candidature.pays }}</span>
              <span aria-hidden="true">·</span>
            </template>
            <span>Reçue le {{ formatDateQuebec(candidature.dateEnvoi) }}</span>
          </p>
        </div>

        <div class="w-full sm:w-auto">
          <InlineStatutSelect
            v-if="candidature.anonymiseLe === null"
            :model-value="candidature.statut"
            label="Statut de la candidature"
            :options="statutOptions"
            :busy="busy(candidature.uuid)"
            @update:model-value="(v) => emit('statut', candidature, v as StatutCandidatureDto)"
          />
        </div>
      </div>

      <CandidatureDetail v-if="candidature.anonymiseLe === null" :candidature="candidature" />

      <CandidatureActions
        :candidature="candidature"
        :busy="busy(candidature.uuid)"
        @vivier="(c) => emit('vivier', c)"
        @anonymiser="(c) => emit('anonymiser', c)"
        @remove="(c) => emit('remove', c)"
      />
    </article>
  </div>
</template>
