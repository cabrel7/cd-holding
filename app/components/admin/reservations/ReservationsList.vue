<script setup lang="ts">
// Réservations du restaurant : tableau à partir de lg, liste empilée en dessous (un seul des
// deux est rendu). Le statut du Select est piloté par le DTO : sur échec du PATCH, le
// composable d'actions recharge la liste et le Select revient à la valeur serveur.
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { STATUT_RESERVATION_LABELS } from '#shared/config/admin'
import { formatDateHeureQuebec } from '#shared/utils/dates'
import type { AdminReservationDto, StatutReservationDto } from '#shared/types/admin'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import InlineStatutSelect from '../placement/InlineStatutSelect.vue'

const props = defineProps<{
  reservations: readonly AdminReservationDto[]
  busyUuid: string | null
}>()

const emit = defineEmits<{
  statut: [reservation: AdminReservationDto, statut: StatutReservationDto]
}>()

const isTable = useMediaQuery('(min-width: 1024px)')

const STATUT_VARIANTS = {
  EN_ATTENTE: 'default',
  CONFIRMEE: 'secondary',
  ANNULEE: 'outline',
} as const satisfies Record<StatutReservationDto, 'default' | 'secondary' | 'outline'>

const statutOptions = Object.entries(STATUT_RESERVATION_LABELS).map(([value, label]) => ({ value, label }))

const busy = computed(() => (uuid: string) => props.busyUuid === uuid)

const personnes = (reservation: AdminReservationDto): string =>
  `${reservation.nombrePersonnes} ${reservation.nombrePersonnes > 1 ? 'personnes' : 'personne'}`

const telHref = (reservation: AdminReservationDto): string =>
  `tel:${reservation.telephone.replace(/[^+0-9]/g, '')}`
</script>

<template>
  <Table v-if="isTable">
    <TableHeader>
      <TableRow>
        <TableHead>Client</TableHead>
        <TableHead>Personnes</TableHead>
        <TableHead>Date</TableHead>
        <TableHead class="hidden xl:table-cell">Téléphone</TableHead>
        <TableHead class="hidden xl:table-cell">Courriel</TableHead>
        <TableHead>Notes</TableHead>
        <TableHead>Statut</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="reservation in reservations" :key="reservation.uuid" :aria-busy="busy(reservation.uuid)">
        <TableCell class="min-w-0 truncate font-medium text-foreground" :title="reservation.nom">{{ reservation.nom }}</TableCell>
        <TableCell class="tabular-nums">{{ reservation.nombrePersonnes }}</TableCell>
        <TableCell class="whitespace-normal">
          <time :datetime="reservation.dateReservation">{{ formatDateHeureQuebec(reservation.dateReservation) }}</time>
        </TableCell>
        <TableCell class="hidden min-w-0 xl:table-cell">
          <a :href="telHref(reservation)" class="inline-flex min-h-11 items-center underline-offset-2 hover:underline md:min-h-0" :title="reservation.telephone">{{ reservation.telephone }}</a>
        </TableCell>
        <TableCell class="hidden min-w-0 xl:table-cell">
          <a
            :href="`mailto:${reservation.email}`"
            class="inline-flex min-h-11 break-all underline-offset-2 hover:underline md:min-h-0"
            :title="reservation.email"
          >
            {{ reservation.email }}
          </a>
        </TableCell>
        <TableCell class="whitespace-pre-line break-words" :title="reservation.notes ?? undefined">{{ reservation.notes ?? '—' }}</TableCell>
        <TableCell>
          <div class="flex flex-col gap-1.5">
            <Badge :variant="STATUT_VARIANTS[reservation.statut]">{{ STATUT_RESERVATION_LABELS[reservation.statut] }}</Badge>
            <InlineStatutSelect
              :model-value="reservation.statut"
              :label="`Statut de la réservation de ${reservation.nom}`"
              :options="statutOptions"
              :busy="busy(reservation.uuid)"
              @update:model-value="(v) => emit('statut', reservation, v as StatutReservationDto)"
            />
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>

  <ul v-else class="divide-y divide-border border-y border-border">
    <li v-for="reservation in reservations" :key="reservation.uuid" class="space-y-2 py-4" :aria-busy="busy(reservation.uuid)">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-medium text-foreground">{{ reservation.nom }}</p>
          <p class="text-sm text-muted-foreground">
            {{ personnes(reservation) }} · <time :datetime="reservation.dateReservation">{{ formatDateHeureQuebec(reservation.dateReservation) }}</time>
          </p>
        </div>
        <Badge :variant="STATUT_VARIANTS[reservation.statut]">{{ STATUT_RESERVATION_LABELS[reservation.statut] }}</Badge>
      </div>
      <p class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <a
          :href="`mailto:${reservation.email}`"
          class="inline-flex min-h-11 break-all underline-offset-2 hover:underline md:min-h-0"
        >
          {{ reservation.email }}
        </a>
        <span aria-hidden="true">·</span>
        <a :href="telHref(reservation)" class="inline-flex min-h-11 items-center underline-offset-2 hover:underline md:min-h-0">{{ reservation.telephone }}</a>
      </p>
      <p v-if="reservation.notes" class="whitespace-pre-line break-words text-sm text-muted-foreground">{{ reservation.notes }}</p>
      <div class="flex flex-wrap items-end gap-3 pt-1">
        <InlineStatutSelect
          :model-value="reservation.statut"
          :label="`Statut de la réservation de ${reservation.nom}`"
          :options="statutOptions"
          :busy="busy(reservation.uuid)"
          @update:model-value="(v) => emit('statut', reservation, v as StatutReservationDto)"
        />
      </div>
    </li>
  </ul>
</template>
