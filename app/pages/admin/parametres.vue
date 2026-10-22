<script setup lang="ts">
// Paramètres du compte : profil en lecture seule (Nom / Courriel / Rôle / Filiale rattachée)
// repris du prototype + changement de mot de passe (D9 : la seule porte de secours d'un employé).
// Tous les champs affichés viennent du GET — la session ne contient pas le courriel.
import { computed, ref } from 'vue'
import { ROLE_LABELS } from '#shared/config/admin'
import type { AdminProfilDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { watchAdminUnauthorized } from '@/utils/admin-unauthorized'
import type { AdminListState as EtatListe } from '@/composables/useAdminPagedList'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import MotDePasseDialog from '@/components/admin/parametres/MotDePasseDialog.vue'
import { useMotDePasseAction, type MotDePasseValeurs } from '@/components/admin/parametres/useMotDePasseAction'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE, ROLES.EMPLOYE],
})

useHead({ title: 'Paramètres' })

const { data, error, refresh } = useFetch<AdminProfilDto | null>('/api/admin/profil', {
  server: false,
  key: 'admin-profil',
  default: () => null,
})

watchAdminUnauthorized(error)

const messageErreur = computed(() => (error.value ? toAdminError(error.value).message : undefined))

const etat = computed<EtatListe>(() => {
  if (error.value) return 'error'
  if (!data.value) return 'loading'
  return 'ready'
})

// Libellé exact du prototype : un compte holding n'a aucune filiale rattachée.
const filialeTexte = computed(() => data.value?.company?.nom ?? 'Aucune (accès groupe entier)')

const dialogOpen = ref(false)
const actions = useMotDePasseAction()

function ouvrirDialog(): void {
  actions.clearFieldErrors()
  dialogOpen.value = true
}

function onDialogOpen(open: boolean): void {
  if (!open && actions.submitting.value) return
  dialogOpen.value = open
}

async function onDialogSubmit(valeurs: MotDePasseValeurs): Promise<void> {
  if (await actions.changer(valeurs)) dialogOpen.value = false
}
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Paramètres" description="Consultez votre compte et modifiez votre mot de passe." />

    <AdminListState
      :state="etat"
      :squelettes="4"
      message-vide="Aucune information à afficher."
      :message-erreur="messageErreur"
      @retry="refresh()"
    >
      <!-- Contenu borné (max-w-3xl comme le prototype) : 4 lignes courtes débordées sur
           max-w-7xl formeraient une bande blanche de 1150 px. L'en-tête reste pleine largeur. -->
      <div v-if="data" class="max-w-2xl space-y-6 md:max-w-3xl">
        <dl class="grid grid-cols-1 gap-x-8 gap-y-4 rounded-lg border border-border bg-card p-6 md:grid-cols-[180px_1fr]">
          <dt class="text-sm text-muted-foreground">Nom</dt>
          <dd class="min-w-0 break-words text-sm font-medium text-navy">{{ data.nom }}</dd>

          <dt class="text-sm text-muted-foreground">Courriel</dt>
          <dd class="min-w-0 break-words text-sm font-medium text-navy">{{ data.email }}</dd>

          <dt class="text-sm text-muted-foreground">Rôle</dt>
          <dd><Badge variant="secondary">{{ ROLE_LABELS[data.role] }}</Badge></dd>

          <dt class="text-sm text-muted-foreground">Filiale rattachée</dt>
          <dd class="min-w-0 break-words text-sm font-medium text-navy">{{ filialeTexte }}</dd>
        </dl>

        <section aria-labelledby="parametres-mdp" class="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 id="parametres-mdp" class="font-display text-lg font-semibold text-navy">Mot de passe</h2>
          <p class="text-sm text-muted-foreground">Modifiez le mot de passe utilisé pour vous connecter à la console.</p>
          <Button class="min-h-11 md:min-h-9" @click="ouvrirDialog">Changer le mot de passe</Button>
        </section>
      </div>
    </AdminListState>

    <MotDePasseDialog
      :open="dialogOpen"
      :submitting="actions.submitting.value"
      :actuel-error="actions.actuelError.value"
      @update:open="onDialogOpen"
      @submit="onDialogSubmit"
    />
  </div>
</template>
