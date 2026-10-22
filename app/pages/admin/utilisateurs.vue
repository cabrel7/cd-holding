<script setup lang="ts">
// Comptes de la console (super administrateur seul, D2) : liste filtrable, création, édition,
// réinitialisation de mot de passe, désactivation/réactivation. Ni suppression définitive (D5,
// remplacée par `actif`) ni édition du courriel (D6 : identifiant de connexion immuable). Le
// mot de passe temporaire (D14) n'est affiché qu'une fois, après le 201/200.
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import { isFilialeSlug, type FilialeSlug } from '#shared/config/sites'
import type { AdminCompteDto } from '#shared/types/admin'
import {
  utilisateursQuerySchema,
  type UtilisateurCreateInput,
  type UtilisateurUpdateInput,
  type UtilisateursQuery,
} from '#shared/validation/utilisateurs'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import CompteFilters from '@/components/admin/utilisateurs/CompteFilters.vue'
import CompteFormDialog from '@/components/admin/utilisateurs/CompteFormDialog.vue'
import ComptesList from '@/components/admin/utilisateurs/ComptesList.vue'
import MotDePasseTemporaireDialog from '@/components/admin/utilisateurs/MotDePasseTemporaireDialog.vue'
import { useCompteActions } from '@/components/admin/utilisateurs/useCompteActions'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN],
})

useHead({ title: 'Utilisateurs — Administration' })

const { sites } = useAdminShell()

const { query, searchInput, hasFilters, setFilter, setPage, reset } = useAdminListQuery<UtilisateursQuery>(utilisateursQuerySchema, [
  'role',
  'actif',
  'q',
  'page',
])

const list = useAdminPagedList<AdminCompteDto, UtilisateursQuery>({
  endpoint: '/api/admin/utilisateurs',
  query,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

const actions = useCompteActions(list.refresh)

// Rattachements proposés : les 6 filiales réelles du shell (holding exclue, D7).
const filialesOptions = computed(() => {
  const out: { value: FilialeSlug; label: string }[] = []
  for (const site of sites.value) {
    if (isFilialeSlug(site.slug)) out.push({ value: site.slug, label: site.nomCourt ?? site.nom })
  }
  return out
})

// --- formulaire (création ou édition) ---
type FormMode = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly compte: AdminCompteDto }

const formMode = ref<FormMode>({ kind: 'create' })
const formOpen = ref(false)

const editedCompte = computed(() => (formMode.value.kind === 'edit' ? formMode.value.compte : null))
const formTitre = computed(() => (editedCompte.value ? 'Modifier le compte' : 'Nouveau compte'))

function openCreate(): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'create' }
  formOpen.value = true
}

function openEdit(compte: AdminCompteDto): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'edit', compte }
  formOpen.value = true
}

function onFormOpen(open: boolean): void {
  if (!open && actions.submitting.value) return
  formOpen.value = open
}

// --- mot de passe temporaire (commun création / reset) ---
const mdpTemporaire = ref('')
const mdpOpen = ref(false)

function afficherMotDePasse(motDePasse: string): void {
  mdpTemporaire.value = motDePasse
  mdpOpen.value = true
}

async function onFormSubmit(payload: UtilisateurCreateInput | UtilisateurUpdateInput): Promise<void> {
  const compte = editedCompte.value
  if (compte) {
    if (await actions.update(compte.uuid, payload as UtilisateurUpdateInput)) formOpen.value = false
    return
  }
  const motDePasse = await actions.create(payload as UtilisateurCreateInput)
  if (motDePasse === null) return
  formOpen.value = false
  afficherMotDePasse(motDePasse)
}

async function reinitialiser(compte: AdminCompteDto): Promise<void> {
  const motDePasse = await actions.reinitialiserMotDePasse(compte.uuid)
  if (motDePasse !== null) afficherMotDePasse(motDePasse)
}

// --- désactivation (AlertDialog, jamais `confirm()`) / réactivation ---
const aDesactiver = ref<AdminCompteDto | null>(null)
const desactivationOpen = computed({
  get: () => aDesactiver.value !== null,
  set: (open: boolean) => {
    if (!open && !actions.submitting.value) aDesactiver.value = null
  },
})

async function confirmDesactivation(): Promise<void> {
  const compte = aDesactiver.value
  if (!compte) return
  if (await actions.setActif(compte.uuid, false)) aDesactiver.value = null
}

function onBasculer(compte: AdminCompteDto): void {
  // Désactivation = destructif (sessions fermées) : confirmation. Réactivation : directe.
  if (compte.actif) aDesactiver.value = compte
  else void actions.setActif(compte.uuid, true)
}
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Utilisateurs" description="Gérez les comptes de la console : nom, rôle, filiale et mot de passe.">
      <Button class="min-h-11 md:min-h-9" @click="openCreate">
        <Plus aria-hidden="true" />
        Nouveau compte
      </Button>
    </AdminPageHeader>

    <CompteFilters
      v-model:search="searchInput"
      :role="query.role"
      :actif="query.actif"
      :has-filters="hasFilters"
      @update:role="(v) => setFilter('role', v)"
      @update:actif="(v) => setFilter('actif', v)"
      @reset="reset"
    />

    <AdminListState
      :state="list.state.value"
      message-vide="Aucun compte pour l'instant."
      message-vide-filtre="Aucun compte ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <template #vide-action>
        <Button class="min-h-11 md:min-h-9" @click="openCreate">Nouveau compte</Button>
      </template>
      <div :class="{ 'opacity-80 transition-opacity': list.refreshing.value }" :aria-busy="list.refreshing.value">
        <ComptesList
          :comptes="list.items.value"
          @edit="openEdit"
          @reinitialiser="(compte) => void reinitialiser(compte)"
          @basculer="onBasculer"
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

    <CompteFormDialog
      :open="formOpen"
      :titre="formTitre"
      :compte="editedCompte"
      :filiales="filialesOptions"
      :submitting="actions.submitting.value"
      :email-error="actions.emailError.value"
      @update:open="onFormOpen"
      @submit="onFormSubmit"
    />

    <MotDePasseTemporaireDialog :open="mdpOpen" :mot-de-passe="mdpTemporaire" @update:open="(v) => (mdpOpen = v)" />

    <AlertDialog :open="desactivationOpen" @update:open="(v) => (desactivationOpen = v)">
      <AlertDialogContent @escape-key-down="(e) => { if (actions.submitting.value) e.preventDefault() }">
        <AlertDialogHeader>
          <AlertDialogTitle>Désactiver ce compte ?</AlertDialogTitle>
          <AlertDialogDescription>Ce compte ne pourra plus se connecter et ses sessions seront fermées.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel class="min-h-11 md:min-h-9" :disabled="actions.submitting.value">Annuler</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            class="min-h-11 md:min-h-9"
            :disabled="actions.submitting.value"
            :aria-busy="actions.submitting.value"
            @click="confirmDesactivation"
          >
            {{ actions.submitting.value ? 'Désactivation…' : 'Désactiver' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
