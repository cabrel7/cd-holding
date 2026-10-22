<script setup lang="ts">
// Comptes de la console : tableau à partir de lg, liste empilée en dessous (un seul des deux
// est rendu). Le courriel (identifiant de connexion, immuable) a sa colonne dès 1280 px et
// double sous le nom en dessous : le tableau lg doit rester lisible avec la sidebar ouverte.
// Actions : Modifier / Réinitialiser le mot de passe / Désactiver — Réactiver si `actif` faux.
import { useMediaQuery } from '@vueuse/core'
import { KeyRound, Pencil, UserCheck, UserX } from '@lucide/vue'
import { ROLE_LABELS, STATUT_COMPTE_LABELS } from '#shared/config/admin'
import type { AdminCompteDto } from '#shared/types/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

defineProps<{
  comptes: readonly AdminCompteDto[]
}>()

const emit = defineEmits<{
  edit: [compte: AdminCompteDto]
  reinitialiser: [compte: AdminCompteDto]
  basculer: [compte: AdminCompteDto]
}>()

const isTable = useMediaQuery('(min-width: 1024px)')

function filialeTexte(compte: AdminCompteDto): string {
  return compte.company?.nom ?? 'Aucune (accès groupe entier)'
}

function statutCle(compte: AdminCompteDto): keyof typeof STATUT_COMPTE_LABELS {
  return compte.actif ? 'actif' : 'inactif'
}
</script>

<template>
  <Table v-if="isTable">
    <TableHeader>
      <TableRow>
        <TableHead>Nom</TableHead>
        <TableHead class="hidden xl:table-cell">Courriel</TableHead>
        <TableHead>Rôle</TableHead>
        <TableHead>Filiale</TableHead>
        <TableHead>Statut</TableHead>
        <TableHead class="w-36 text-right"><span class="sr-only">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="compte in comptes" :key="compte.uuid">
        <TableCell class="min-w-0">
          <button
            type="button"
            class="focus-visible:ring-ring text-foreground -mx-1 block max-w-full truncate rounded-sm px-1 text-left font-medium underline-offset-2 outline-hidden hover:underline focus-visible:ring-2"
            :title="`Modifier ${compte.nom}`"
            @click="emit('edit', compte)"
          >
            {{ compte.nom }}
          </button>
          <div class="truncate text-muted-foreground xl:hidden" :title="compte.email">{{ compte.email }}</div>
        </TableCell>
        <TableCell class="hidden min-w-0 xl:table-cell">
          <div class="truncate" :title="compte.email">{{ compte.email }}</div>
        </TableCell>
        <TableCell><Badge variant="secondary">{{ ROLE_LABELS[compte.role] }}</Badge></TableCell>
        <TableCell class="min-w-0">
          <span class="block truncate" :title="filialeTexte(compte)">{{ filialeTexte(compte) }}</span>
        </TableCell>
        <TableCell>
          <Badge :variant="compte.actif ? 'default' : 'secondary'">{{ STATUT_COMPTE_LABELS[statutCle(compte)] }}</Badge>
        </TableCell>
        <TableCell>
          <div class="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="min-h-11 min-w-11"
              :aria-label="`Modifier ${compte.nom}`"
              :title="`Modifier ${compte.nom}`"
              @click="emit('edit', compte)"
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="min-h-11 min-w-11"
              :aria-label="`Réinitialiser le mot de passe de ${compte.nom}`"
              :title="`Réinitialiser le mot de passe de ${compte.nom}`"
              @click="emit('reinitialiser', compte)"
            >
              <KeyRound aria-hidden="true" />
            </Button>
            <Button
              v-if="compte.actif"
              variant="ghost"
              size="icon"
              class="min-h-11 min-w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              :aria-label="`Désactiver ${compte.nom}`"
              :title="`Désactiver ${compte.nom}`"
              @click="emit('basculer', compte)"
            >
              <UserX aria-hidden="true" />
            </Button>
            <Button
              v-else
              variant="ghost"
              size="icon"
              class="min-h-11 min-w-11"
              :aria-label="`Réactiver ${compte.nom}`"
              :title="`Réactiver ${compte.nom}`"
              @click="emit('basculer', compte)"
            >
              <UserCheck aria-hidden="true" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>

  <ul v-else class="divide-y divide-border border-y border-border">
    <li v-for="compte in comptes" :key="compte.uuid" class="space-y-2 py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-medium text-foreground">{{ compte.nom }}</p>
          <p class="break-all text-sm">{{ compte.email }}</p>
        </div>
        <Badge variant="secondary">{{ ROLE_LABELS[compte.role] }}</Badge>
      </div>
      <p class="text-sm text-muted-foreground">{{ filialeTexte(compte) }}</p>
      <Badge :variant="compte.actif ? 'default' : 'secondary'">{{ STATUT_COMPTE_LABELS[statutCle(compte)] }}</Badge>
      <div class="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" class="min-h-11" @click="emit('edit', compte)">
          <Pencil aria-hidden="true" />
          Modifier
        </Button>
        <Button variant="outline" class="min-h-11" @click="emit('reinitialiser', compte)">
          <KeyRound aria-hidden="true" />
          Réinitialiser le mot de passe
        </Button>
        <Button
          v-if="compte.actif"
          variant="ghost"
          class="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          @click="emit('basculer', compte)"
        >
          <UserX aria-hidden="true" />
          Désactiver
        </Button>
        <Button v-else variant="ghost" class="min-h-11" @click="emit('basculer', compte)">
          <UserCheck aria-hidden="true" />
          Réactiver
        </Button>
      </div>
    </li>
  </ul>
</template>
