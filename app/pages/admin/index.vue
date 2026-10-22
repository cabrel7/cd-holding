<script setup lang="ts">
// Tableau de bord : activité par site et derniers messages. Réservé aux gestionnaires —
// tout EMPLOYE est redirigé vers /admin/mon-planning par le middleware admin (lot 5 planning).
import { computed } from 'vue'
import { STATUT_MESSAGE_LABELS, STATUT_RESERVATION_LABELS } from '#shared/config/admin'
import { formatDateHeureQuebec } from '#shared/utils/dates'
import type { AdminDashboardDto, StatutReservationDto, StatutSiteDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { watchAdminUnauthorized } from '@/utils/admin-unauthorized'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({ middleware: 'admin', layout: 'admin' })

useHead({ title: 'Tableau de bord — Administration' })

const STATUT_SITE_LABELS: Record<StatutSiteDto, string> = {
  ACTIF: 'Actif',
  EN_MAINTENANCE: 'En maintenance',
  EN_CONSTRUCTION: 'En construction',
}

const STATUT_RESERVATION_VARIANTS = {
  EN_ATTENTE: 'default',
  CONFIRMEE: 'secondary',
  ANNULEE: 'outline',
} as const satisfies Record<StatutReservationDto, 'default' | 'secondary' | 'outline'>

const authStore = useAuthStore()

// Cibles normalisées vers la forme servie sur l'hôte admin (D8) : nu là-bas, préfixée ailleurs.
const cheminMessages = toAdminPath('/admin/messages')
const cheminReservations = toAdminPath('/admin/ccdpaa/reservations')

const { data, status, error, refresh } = useFetch<AdminDashboardDto | null>('/api/admin/dashboard', {
  server: false,
  key: 'admin-dashboard',
  default: () => null,
})

watchAdminUnauthorized(error)

const totalNouveaux = computed(() => data.value?.sites.reduce((sum, row) => sum + row.messagesNouveaux, 0) ?? 0)

const errorMessage = computed(() => (error.value ? toAdminError(error.value).message : null))
const isLoading = computed(() => status.value === 'pending' || (data.value === null && !error.value))
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-8']">
    <AdminPageHeader titre="Tableau de bord" :description="authStore.user ? `Bonjour ${authStore.user.nom}.` : undefined" />

    <div v-if="errorMessage" role="alert" class="space-y-3 border-l-2 border-destructive py-2 pl-4">
      <p class="text-sm text-foreground">{{ errorMessage }}</p>
      <Button variant="outline" class="min-h-11 md:min-h-9" @click="refresh()">Réessayer</Button>
    </div>

    <div v-else-if="isLoading || !data" role="status" aria-live="polite" class="space-y-4">
      <span class="sr-only">Chargement…</span>
      <Skeleton class="h-6 w-1/4" />
      <Skeleton class="h-40 w-full" />
      <Skeleton class="h-6 w-1/4" />
      <Skeleton class="h-32 w-full" />
    </div>

    <template v-else>
      <section aria-labelledby="dash-sites" class="space-y-3">
        <h2 id="dash-sites" class="font-display text-navy text-xl font-semibold">Activité par site</h2>
        <p v-if="data.sites.length === 0" class="text-sm text-foreground">Aucun site.</p>
        <template v-else>
          <div class="hidden lg:block">
            <Table>
              <caption class="sr-only">Activité par site</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead class="text-right">Messages nouveaux</TableHead>
                  <TableHead class="text-right">Clients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in data.sites" :key="row.site.uuid">
                  <TableCell class="font-medium">
                    <span class="inline-flex items-center gap-2">
                      <span class="size-3 shrink-0 rounded-full border border-border" :style="{ backgroundColor: row.couleurAccent }" aria-hidden="true" />
                      {{ row.site.nom }}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge :variant="row.statutSite === 'ACTIF' ? 'secondary' : 'outline'">{{ STATUT_SITE_LABELS[row.statutSite] }}</Badge>
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    <NuxtLink
                      v-if="row.messagesNouveaux > 0"
                      :to="{ path: cheminMessages, query: { site: row.site.slug, statut: 'NOUVEAU' } }"
                      class="inline-flex min-h-11 items-center font-medium underline underline-offset-2 md:min-h-0"
                    >
                      {{ row.messagesNouveaux }}
                    </NuxtLink>
                    <span v-else class="text-muted-foreground">0</span>
                  </TableCell>
                  <TableCell class="text-right tabular-nums">{{ row.clients }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <ul class="divide-y divide-border border-y border-border lg:hidden">
            <li v-for="row in data.sites" :key="row.site.uuid" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span class="size-3 shrink-0 rounded-full border border-border" :style="{ backgroundColor: row.couleurAccent }" aria-hidden="true" />
                  <span class="truncate">{{ row.site.nom }}</span>
                </p>
                <p class="mt-1 text-sm text-muted-foreground">
                  <NuxtLink
                    v-if="row.messagesNouveaux > 0"
                    :to="{ path: cheminMessages, query: { site: row.site.slug, statut: 'NOUVEAU' } }"
                    class="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-2"
                  >
                    {{ row.messagesNouveaux }} {{ row.messagesNouveaux > 1 ? 'nouveaux' : 'nouveau' }}
                  </NuxtLink>
                  <template v-else>0 nouveau</template>
                  · {{ row.clients }} {{ row.clients > 1 ? 'clients' : 'client' }}
                </p>
              </div>
              <Badge :variant="row.statutSite === 'ACTIF' ? 'secondary' : 'outline'">{{ STATUT_SITE_LABELS[row.statutSite] }}</Badge>
            </li>
          </ul>
        </template>
      </section>

      <section aria-labelledby="dash-messages" class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="dash-messages" class="font-display text-navy text-xl font-semibold">Derniers messages</h2>
          <NuxtLink
            v-if="totalNouveaux > 0"
            :to="{ path: cheminMessages, query: { statut: 'NOUVEAU' } }"
            class="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2 md:min-h-0"
          >
            Voir les messages non lus
          </NuxtLink>
        </div>
        <p v-if="data.derniersMessages.length === 0" class="text-sm text-foreground">Aucun message reçu pour l'instant.</p>
        <ul v-else class="divide-y divide-border border-y border-border">
          <li v-for="message in data.derniersMessages" :key="message.uuid">
            <NuxtLink
              :to="{ path: cheminMessages, query: { site: message.site.slug, statut: message.statut } }"
              class="hover:bg-accent focus-visible:ring-ring flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 py-3 outline-hidden focus-visible:ring-2"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-foreground">{{ message.sujet ?? 'Sans objet' }}</span>
                <span class="block text-sm text-muted-foreground">{{ message.nom }} · {{ message.site.nom }}</span>
              </span>
              <span class="flex items-center gap-3">
                <Badge :variant="message.statut === 'NOUVEAU' ? 'default' : 'outline'">{{ STATUT_MESSAGE_LABELS[message.statut] }}</Badge>
                <time :datetime="message.createdAt" class="text-sm text-muted-foreground">{{ formatDateHeureQuebec(message.createdAt) }}</time>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section v-if="data.prochainesReservations.length > 0" aria-labelledby="dash-reservations" class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="dash-reservations" class="font-display text-navy text-xl font-semibold">Prochaines réservations</h2>
          <NuxtLink
            :to="cheminReservations"
            class="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2 md:min-h-0"
          >
            Voir toutes les réservations
          </NuxtLink>
        </div>
        <ul class="divide-y divide-border border-y border-border">
          <li v-for="reservation in data.prochainesReservations" :key="reservation.uuid">
            <NuxtLink
              :to="cheminReservations"
              class="hover:bg-accent focus-visible:ring-ring flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 py-3 outline-hidden focus-visible:ring-2"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-foreground">
                  {{ reservation.nom }} · {{ reservation.nombrePersonnes }}
                  {{ reservation.nombrePersonnes > 1 ? 'personnes' : 'personne' }}
                </span>
              </span>
              <span class="flex items-center gap-3">
                <Badge :variant="STATUT_RESERVATION_VARIANTS[reservation.statut]">{{ STATUT_RESERVATION_LABELS[reservation.statut] }}</Badge>
                <time :datetime="reservation.dateReservation" class="text-sm text-muted-foreground">{{ formatDateHeureQuebec(reservation.dateReservation) }}</time>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
