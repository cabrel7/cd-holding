<script setup lang="ts">
// Tableau de bord : activité par site et derniers messages. Un employé n'a aucun module
// dans ce lot : aucun appel de données, message explicite.
import { computed } from 'vue'
import { STATUT_MESSAGE_LABELS } from '#shared/config/admin'
import { formatDateHeureQuebec } from '#shared/utils/dates'
import type { AdminDashboardDto, StatutSiteDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

definePageMeta({ middleware: 'admin', layout: 'admin' })

useHead({ title: 'Tableau de bord — Administration' })

const STATUT_SITE_LABELS: Record<StatutSiteDto, string> = {
  ACTIF: 'Actif',
  EN_MAINTENANCE: 'En maintenance',
  EN_CONSTRUCTION: 'En construction',
}

const authStore = useAuthStore()
const hasData = computed(() => authStore.user?.role !== ROLES.EMPLOYE)

const { data, status, error, refresh } = useFetch<AdminDashboardDto | null>('/api/admin/dashboard', {
  server: false,
  immediate: hasData.value,
  key: 'admin-dashboard',
  default: () => null,
})

const errorMessage = computed(() => (error.value ? toAdminError(error.value).message : null))
const isLoading = computed(() => status.value === 'pending' || (data.value === null && !error.value))
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-8">
    <AdminPageHeader titre="Tableau de bord" :description="authStore.user ? `Bonjour ${authStore.user.nom}.` : undefined" />

    <p v-if="!hasData" class="max-w-prose text-sm text-foreground">Aucun module disponible pour votre compte.</p>

    <div v-else-if="errorMessage" role="alert" class="space-y-3 border-l-2 border-destructive py-2 pl-4">
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
        <h2 id="dash-sites" class="text-lg font-semibold text-foreground">Activité par site</h2>
        <Table>
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
                  :to="{ path: '/admin/messages', query: { site: row.site.slug, statut: 'NOUVEAU' } }"
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
      </section>

      <section aria-labelledby="dash-messages" class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="dash-messages" class="text-lg font-semibold text-foreground">Derniers messages</h2>
          <NuxtLink
            :to="{ path: '/admin/messages', query: { statut: 'NOUVEAU' } }"
            class="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2 md:min-h-0"
          >
            Voir les messages non lus
          </NuxtLink>
        </div>
        <p v-if="data.derniersMessages.length === 0" class="text-sm text-foreground">Aucun message reçu pour l'instant.</p>
        <ul v-else class="divide-y divide-border border-y border-border">
          <li v-for="message in data.derniersMessages" :key="message.uuid" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-foreground">{{ message.sujet ?? 'Sans objet' }}</p>
              <p class="text-sm text-muted-foreground">{{ message.nom }} · {{ message.site.nom }}</p>
            </div>
            <div class="flex items-center gap-3">
              <Badge :variant="message.statut === 'NOUVEAU' ? 'default' : 'outline'">{{ STATUT_MESSAGE_LABELS[message.statut] }}</Badge>
              <time :datetime="message.createdAt" class="text-sm text-muted-foreground">{{ formatDateHeureQuebec(message.createdAt) }}</time>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
