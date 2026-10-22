<script setup lang="ts">
// Réservations du restaurant CCDPAA : liste + changement de statut en ligne (rien d'autre,
// comme le prototype). Filtres et page vivent dans l'URL.
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminReservationDto } from '#shared/types/admin'
import { reservationsQuerySchema, type ReservationsQuery } from '#shared/validation/reservation'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import ReservationFilters from '@/components/admin/reservations/ReservationFilters.vue'
import ReservationsList from '@/components/admin/reservations/ReservationsList.vue'
import { useReservationActions } from '@/components/admin/reservations/useReservationActions'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'CCDPAA — Réservations' })

const { query, searchInput, hasFilters, setFilter, setPage, reset } = useAdminListQuery<ReservationsQuery>(
  reservationsQuerySchema,
  ['statut', 'q', 'page'],
)

const list = useAdminPagedList<AdminReservationDto, ReservationsQuery>({
  endpoint: '/api/admin/reservations',
  query,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

const actions = useReservationActions(list.refresh)
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Réservations" description="Les réservations du restaurant CCDPAA arrivent ici." />

    <ReservationFilters
      v-model:search="searchInput"
      :statut="query.statut"
      :has-filters="hasFilters"
      @update:statut="(v) => setFilter('statut', v)"
      @reset="reset"
    />

    <AdminListState
      :state="list.state.value"
      message-vide="Aucune réservation."
      message-vide-filtre="Aucune réservation ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <div :class="{ 'opacity-80 transition-opacity': list.refreshing.value }" :aria-busy="list.refreshing.value">
        <ReservationsList
          :reservations="list.items.value"
          :busy-uuid="actions.busyUuid.value"
          @statut="(reservation, statut) => actions.updateStatut(reservation.uuid, statut)"
        />
      </div>
      <AdminPagination
        :page="list.page.value"
        :page-count="list.pageCount.value"
        :page-size="list.pageSize.value || ADMIN_PAGE_SIZE"
        :total="list.total.value"
        @update:page="setPage"
      />
    </AdminListState>
  </div>
</template>
