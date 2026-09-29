<script setup lang="ts">
// Clients : tableau à partir de md, liste empilée en dessous (un seul des deux est rendu).
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Pencil, Trash2 } from '@lucide/vue'
import { STATUT_CLIENT_LABELS } from '#shared/config/admin'
import { formatDateQuebec } from '#shared/utils/dates'
import type { AdminClientDto, StatutClientDto } from '#shared/types/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

defineProps<{
  clients: readonly AdminClientDto[]
  showSite: boolean
}>()

const emit = defineEmits<{
  edit: [client: AdminClientDto]
  remove: [client: AdminClientDto]
}>()

const isTable = useMediaQuery('(min-width: 768px)')

const BADGE_VARIANTS = { PROSPECT: 'outline', CLIENT_ACTIF: 'default', INACTIF: 'secondary' } as const satisfies Record<
  StatutClientDto,
  'outline' | 'default' | 'secondary'
>

const dateOuTiret = computed(() => (iso: string | null) => (iso ? formatDateQuebec(iso) : '—'))
</script>

<template>
  <Table v-if="isTable">
    <TableHeader>
      <TableRow>
        <TableHead>Nom</TableHead>
        <TableHead>Contact</TableHead>
        <TableHead v-if="showSite">Site</TableHead>
        <TableHead>Statut</TableHead>
        <TableHead>Dernière interaction</TableHead>
        <TableHead class="w-24 text-right"><span class="sr-only">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="client in clients" :key="client.uuid">
        <TableCell class="whitespace-normal">
          <div class="font-medium text-foreground">{{ client.nom }}</div>
          <div v-if="client.entreprise" class="text-muted-foreground">{{ client.entreprise }}</div>
        </TableCell>
        <TableCell class="whitespace-normal">
          <div v-if="client.email" class="break-all">{{ client.email }}</div>
          <div v-if="client.telephone" class="text-muted-foreground">{{ client.telephone }}</div>
          <span v-if="!client.email && !client.telephone" class="text-muted-foreground">—</span>
        </TableCell>
        <TableCell v-if="showSite">{{ client.site.nom }}</TableCell>
        <TableCell><Badge :variant="BADGE_VARIANTS[client.statut]">{{ STATUT_CLIENT_LABELS[client.statut] }}</Badge></TableCell>
        <TableCell>{{ dateOuTiret(client.derniereInteraction) }}</TableCell>
        <TableCell class="text-right">
          <Button variant="ghost" size="icon" class="size-9" :aria-label="`Modifier ${client.nom}`" @click="emit('edit', client)">
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            :aria-label="`Supprimer ${client.nom}`"
            @click="emit('remove', client)"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>

  <ul v-else class="divide-y divide-border border-y border-border">
    <li v-for="client in clients" :key="client.uuid" class="space-y-2 py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-medium text-foreground">{{ client.nom }}</p>
          <p v-if="client.entreprise" class="text-sm text-muted-foreground">{{ client.entreprise }}</p>
        </div>
        <Badge :variant="BADGE_VARIANTS[client.statut]">{{ STATUT_CLIENT_LABELS[client.statut] }}</Badge>
      </div>
      <p v-if="client.email" class="break-all text-sm">{{ client.email }}</p>
      <p v-if="client.telephone" class="text-sm text-muted-foreground">{{ client.telephone }}</p>
      <p class="text-sm text-muted-foreground">
        <template v-if="showSite">{{ client.site.nom }} · </template>Dernière interaction : {{ dateOuTiret(client.derniereInteraction) }}
      </p>
      <div class="flex gap-2 pt-1">
        <Button variant="outline" class="min-h-11" @click="emit('edit', client)">
          <Pencil aria-hidden="true" />
          Modifier
        </Button>
        <Button
          variant="ghost"
          class="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          @click="emit('remove', client)"
        >
          <Trash2 aria-hidden="true" />
          Supprimer
        </Button>
      </div>
    </li>
  </ul>
</template>
