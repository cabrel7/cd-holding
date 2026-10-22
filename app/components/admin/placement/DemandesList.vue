<script setup lang="ts">
// Demandes des entreprises clientes : liste d'articles (pas de tableau — trop de contenu lié par
// ligne). Statut en ligne, publication comme offre, candidats correspondants et affectations.
import { useId } from 'vue'
import { Pencil, Trash2 } from '@lucide/vue'
import { CATEGORIE_POSTE_LABELS, STATUT_DEMANDE_LABELS } from '#shared/config/admin'
import { formatDateLongue, formatDateQuebec } from '#shared/utils/dates'
import type { AdminDemandeDto, StatutDemandeDto } from '#shared/types/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import AffectationsList from './AffectationsList.vue'
import CorrespondantsList from './CorrespondantsList.vue'
import InlineStatutSelect from './InlineStatutSelect.vue'

const props = defineProps<{
  demandes: readonly AdminDemandeDto[]
  busyUuid: string | null
}>()

const emit = defineEmits<{
  edit: [demande: AdminDemandeDto]
  remove: [demande: AdminDemandeDto]
  statut: [demande: AdminDemandeDto, statut: StatutDemandeDto]
  'toggle-publication': [demande: AdminDemandeDto, value: boolean]
  assign: [demande: AdminDemandeDto, candidatUuid: string]
  retire: [demande: AdminDemandeDto, affectationUuid: string]
}>()

const STATUT_VARIANTS = { OUVERTE: 'default', POURVUE: 'secondary', ANNULEE: 'outline' } as const satisfies Record<
  StatutDemandeDto,
  'default' | 'secondary' | 'outline'
>

const statutOptions = Object.entries(STATUT_DEMANDE_LABELS).map(([value, label]) => ({ value, label }))
const switchId = useId()

const busy = (uuid: string): boolean => props.busyUuid === uuid
</script>

<template>
  <div class="divide-y divide-border border-y border-border">
    <article v-for="demande in demandes" :key="demande.uuid" class="space-y-3 py-5" :aria-busy="busy(demande.uuid)">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold text-foreground">
              {{ demande.entrepriseCliente }} — {{ demande.nombrePostes }} × {{ demande.posteRecherche }}
            </h2>
            <Badge :variant="STATUT_VARIANTS[demande.statut]">{{ STATUT_DEMANDE_LABELS[demande.statut] }}</Badge>
            <Badge v-if="demande.publiee" variant="secondary">Offre publiée</Badge>
            <Badge v-if="demande.recrutementInternational" variant="outline">International</Badge>
          </div>
          <p class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span class="font-medium text-foreground">{{ demande.contactNom }}</span>
            <span aria-hidden="true">·</span>
            <a :href="`mailto:${encodeURIComponent(demande.contactEmail)}`" class="break-all underline-offset-2 hover:underline">{{ demande.contactEmail }}</a>
            <template v-if="demande.contactTelephone">
              <span aria-hidden="true">·</span>
              <span>{{ demande.contactTelephone }}</span>
            </template>
            <template v-if="demande.dateDebut">
              <span aria-hidden="true">·</span>
              <span>Début : {{ formatDateLongue(demande.dateDebut) }}</span>
            </template>
          </p>
          <p class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{{ CATEGORIE_POSTE_LABELS[demande.categorie] }}</span>
            <template v-if="demande.posteAutrePrecision">
              <span aria-hidden="true">·</span>
              <span>{{ demande.posteAutrePrecision }}</span>
            </template>
            <template v-if="demande.publieeLe">
              <span aria-hidden="true">·</span>
              <span>Publiée le {{ formatDateQuebec(demande.publieeLe) }}</span>
            </template>
          </p>
        </div>

        <div class="flex flex-col gap-2 md:items-end">
          <InlineStatutSelect
            :model-value="demande.statut"
            label="Statut de la demande"
            :options="statutOptions"
            :busy="busy(demande.uuid)"
            @update:model-value="(v) => emit('statut', demande, v as StatutDemandeDto)"
          />
          <div class="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="min-h-11 md:min-h-9"
              :aria-label="`Modifier la demande de ${demande.entrepriseCliente}`"
              :title="`Modifier la demande de ${demande.entrepriseCliente}`"
              @click="emit('edit', demande)"
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:min-h-9"
              :aria-label="`Supprimer la demande de ${demande.entrepriseCliente}`"
              :title="`Supprimer la demande de ${demande.entrepriseCliente}`"
              @click="emit('remove', demande)"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <CorrespondantsList
        :correspondants="demande.correspondants"
        :busy="busy(demande.uuid)"
        @assign="(candidatUuid) => emit('assign', demande, candidatUuid)"
      />

      <AffectationsList
        :affectations="demande.affectations"
        :busy="busy(demande.uuid)"
        @retire="(affectationUuid) => emit('retire', demande, affectationUuid)"
      />

      <div class="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div class="min-w-0">
          <Label :for="`${switchId}-${demande.uuid}`" class="text-sm text-foreground">Publier comme offre d'emploi</Label>
          <p class="text-xs text-muted-foreground">
            Rend le poste visible sur la page des offres du site Placement.
          </p>
        </div>
        <Switch
          :id="`${switchId}-${demande.uuid}`"
          :model-value="demande.publiee"
          :disabled="busy(demande.uuid)"
          @update:model-value="(v) => emit('toggle-publication', demande, v === true)"
        />
      </div>
    </article>
  </div>
</template>
