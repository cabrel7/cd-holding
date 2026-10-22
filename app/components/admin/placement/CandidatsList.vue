<script setup lang="ts">
// Vivier : tableau à partir de lg, liste empilée en dessous (un seul des deux est rendu).
// Chaque ligne conserve sa place même anonymisée : les PII sont alors remplacées par « — ».
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Pencil, Trash2 } from '@lucide/vue'
import {
  CATEGORIE_POSTE_LABELS,
  ORIGINE_CANDIDAT_LABELS,
  STATUT_CANDIDAT_LABELS,
} from '#shared/config/admin'
import { formatDateQuebec } from '#shared/utils/dates'
import type { AdminCandidatDto, OrigineCandidatDto, StatutCandidatDto } from '#shared/types/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { libellePoste } from '@/utils/placement'
import InlineStatutSelect from './InlineStatutSelect.vue'

const props = defineProps<{
  candidats: readonly AdminCandidatDto[]
  busyUuid: string | null
}>()

const emit = defineEmits<{
  edit: [candidat: AdminCandidatDto]
  remove: [candidat: AdminCandidatDto]
  statut: [candidat: AdminCandidatDto, statut: StatutCandidatDto]
}>()

const isTable = useMediaQuery('(min-width: 1024px)')

const STATUT_VARIANTS = {
  DISPONIBLE: 'default',
  EN_PROCESSUS: 'secondary',
  PLACE: 'outline',
} as const satisfies Record<StatutCandidatDto, 'default' | 'secondary' | 'outline'>

const ORIGINE_VARIANTS = { LOCAL: 'outline', INTERNATIONAL: 'secondary' } as const satisfies Record<
  OrigineCandidatDto,
  'outline' | 'secondary'
>

const statutOptions = Object.entries(STATUT_CANDIDAT_LABELS).map(([value, label]) => ({ value, label }))

const nom = (candidat: AdminCandidatDto): string => candidat.nomComplet ?? '—'

function estAnonymise(candidat: AdminCandidatDto): boolean {
  return candidat.anonymiseLe !== null
}

const busy = computed(() => (uuid: string) => props.busyUuid === uuid)
</script>

<template>
  <Table v-if="isTable">
    <TableHeader>
      <TableRow>
        <TableHead>Nom</TableHead>
        <TableHead>Poste recherché</TableHead>
        <TableHead class="hidden 2xl:table-cell">Catégorie</TableHead>
        <TableHead class="hidden 2xl:table-cell">Disponibilité</TableHead>
        <TableHead class="hidden 2xl:table-cell">Origine</TableHead>
        <TableHead>Statut</TableHead>
        <TableHead class="hidden 2xl:table-cell">Contact</TableHead>
        <TableHead>Ajout</TableHead>
        <TableHead class="w-24 text-right"><span class="sr-only">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="candidat in candidats" :key="candidat.uuid" :aria-busy="busy(candidat.uuid)">
        <TableCell class="min-w-0">
          <template v-if="estAnonymise(candidat)">
            <span
              class="block truncate text-muted-foreground"
              :title="`Anonymisé le ${formatDateQuebec(candidat.anonymiseLe as string)}`"
            >
              Anonymisé le {{ formatDateQuebec(candidat.anonymiseLe as string) }}
            </span>
          </template>
          <template v-else>
            <span class="block truncate font-medium text-foreground" :title="nom(candidat)">{{ nom(candidat) }}</span>
          </template>
        </TableCell>
        <TableCell class="min-w-0"><span class="block truncate" :title="libellePoste(candidat.posteRecherche)">{{ libellePoste(candidat.posteRecherche) }}</span></TableCell>
        <TableCell class="hidden 2xl:table-cell"><Badge variant="secondary">{{ CATEGORIE_POSTE_LABELS[candidat.categorie] }}</Badge></TableCell>
        <TableCell class="hidden min-w-0 2xl:table-cell"><span class="block truncate" :title="candidat.disponibilite ?? undefined">{{ candidat.disponibilite ?? '—' }}</span></TableCell>
        <TableCell class="hidden 2xl:table-cell"><Badge :variant="ORIGINE_VARIANTS[candidat.origine]">{{ ORIGINE_CANDIDAT_LABELS[candidat.origine] }}</Badge></TableCell>
        <TableCell>
          <div class="flex flex-col gap-1.5">
            <Badge :variant="STATUT_VARIANTS[candidat.statut]">{{ STATUT_CANDIDAT_LABELS[candidat.statut] }}</Badge>
            <InlineStatutSelect
              v-if="!estAnonymise(candidat)"
              :model-value="candidat.statut"
              label="Statut du candidat"
              :options="statutOptions"
              :busy="busy(candidat.uuid)"
              @update:model-value="(v) => emit('statut', candidat, v as StatutCandidatDto)"
            />
          </div>
        </TableCell>
        <TableCell class="hidden min-w-0 2xl:table-cell">
          <div v-if="candidat.email" class="truncate" :title="candidat.email">{{ candidat.email }}</div>
          <div v-if="candidat.telephone" class="truncate text-muted-foreground" :title="candidat.telephone">{{ candidat.telephone }}</div>
          <span v-if="!candidat.email && !candidat.telephone" class="text-muted-foreground">—</span>
        </TableCell>
        <TableCell class="whitespace-normal">{{ formatDateQuebec(candidat.createdAt) }}</TableCell>
        <TableCell>
          <div class="flex justify-end gap-1">
            <Button
              v-if="!estAnonymise(candidat)"
              variant="ghost"
              size="icon"
              class="size-9"
              :aria-label="`Modifier ${nom(candidat)}`"
              :title="`Modifier ${nom(candidat)}`"
              @click="emit('edit', candidat)"
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
              :aria-label="`Supprimer ${nom(candidat)}`"
              :title="`Supprimer ${nom(candidat)}`"
              @click="emit('remove', candidat)"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>

  <ul v-else class="divide-y divide-border border-y border-border">
    <li v-for="candidat in candidats" :key="candidat.uuid" class="space-y-2 py-4" :aria-busy="busy(candidat.uuid)">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p v-if="estAnonymise(candidat)" class="text-sm text-muted-foreground">
            Anonymisé le {{ formatDateQuebec(candidat.anonymiseLe as string) }}
          </p>
          <p v-else class="font-medium text-foreground">{{ nom(candidat) }}</p>
          <p class="text-sm text-muted-foreground">{{ libellePoste(candidat.posteRecherche) }}</p>
        </div>
        <Badge :variant="STATUT_VARIANTS[candidat.statut]">{{ STATUT_CANDIDAT_LABELS[candidat.statut] }}</Badge>
      </div>
      <p class="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{{ CATEGORIE_POSTE_LABELS[candidat.categorie] }}</Badge>
        <Badge :variant="ORIGINE_VARIANTS[candidat.origine]">{{ ORIGINE_CANDIDAT_LABELS[candidat.origine] }}</Badge>
        <span v-if="candidat.disponibilite" class="text-muted-foreground">Disponibilité : {{ candidat.disponibilite }}</span>
      </p>
      <p v-if="candidat.email" class="break-all text-sm">{{ candidat.email }}</p>
      <p v-if="candidat.telephone" class="text-sm text-muted-foreground">{{ candidat.telephone }}</p>
      <p class="text-sm text-muted-foreground">Ajouté le {{ formatDateQuebec(candidat.createdAt) }}</p>
      <div class="flex flex-wrap items-end gap-3 pt-1">
        <InlineStatutSelect
          v-if="!estAnonymise(candidat)"
          :model-value="candidat.statut"
          label="Statut du candidat"
          :options="statutOptions"
          :busy="busy(candidat.uuid)"
          @update:model-value="(v) => emit('statut', candidat, v as StatutCandidatDto)"
        />
        <Button v-if="!estAnonymise(candidat)" variant="outline" class="min-h-11" @click="emit('edit', candidat)">
          <Pencil aria-hidden="true" />
          Modifier
        </Button>
        <Button
          variant="ghost"
          class="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          @click="emit('remove', candidat)"
        >
          <Trash2 aria-hidden="true" />
          Supprimer
        </Button>
      </div>
    </li>
  </ul>
</template>
