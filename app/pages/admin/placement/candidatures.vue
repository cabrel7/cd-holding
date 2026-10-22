<script setup lang="ts">
// Onglet Candidatures reçues : statut en ligne, ajout au vivier, anonymisation (Loi 25), suppression.
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminCandidatureDto } from '#shared/types/admin'
import { candidaturesQuerySchema, type CandidaturesQuery } from '#shared/validation/placement'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import CandidatureFilters from '@/components/admin/placement/CandidatureFilters.vue'
import CandidaturesList from '@/components/admin/placement/CandidaturesList.vue'
import PlacementTabs from '@/components/admin/placement/PlacementTabs.vue'
import { useCandidatureActions } from '@/components/admin/placement/useCandidatureActions'
import CmsDeleteDialog from '@/components/cms/CmsDeleteDialog.vue'
import { computed, ref } from 'vue'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Placement — Candidatures' })

const { query, searchInput, hasFilters, setFilter, setPage, reset } = useAdminListQuery<CandidaturesQuery>(candidaturesQuerySchema, [
  'statut',
  'q',
  'page',
])

const list = useAdminPagedList<AdminCandidatureDto, CandidaturesQuery>({
  endpoint: '/api/admin/placement/candidatures',
  query,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

const actions = useCandidatureActions(list.refresh)

const toDelete = ref<AdminCandidatureDto | null>(null)
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (open: boolean) => {
    if (!open && actions.submitting.value) return
    toDelete.value = open ? toDelete.value : null
  },
})

async function confirmDelete(): Promise<void> {
  const target = toDelete.value
  if (!target) return
  if (await actions.remove(target.uuid)) toDelete.value = null
}

// Ajout au vivier et anonymisation Loi 25 : dialogs pilotés par la page, fermés seulement après
// un succès (un échec laisse le dialog ouvert : l'utilisateur voit le toast d'erreur et réessaie).
const toVivier = ref<AdminCandidatureDto | null>(null)
const vivierOuvert = computed({
  get: () => toVivier.value !== null,
  set: (open: boolean) => {
    if (!open && actions.submitting.value) return
    toVivier.value = open ? toVivier.value : null
  },
})

async function confirmVivier(): Promise<void> {
  const cible = toVivier.value
  if (!cible) return
  if (await actions.ajouterAuVivier(cible.uuid)) toVivier.value = null
}

const toAnonymiser = ref<AdminCandidatureDto | null>(null)
const anonymiserOuvert = computed({
  get: () => toAnonymiser.value !== null,
  set: (open: boolean) => {
    if (!open && actions.submitting.value) return
    toAnonymiser.value = open ? toAnonymiser.value : null
  },
})

async function confirmAnonymiser(): Promise<void> {
  const cible = toAnonymiser.value
  if (!cible) return
  if (await actions.anonymiser(cible.uuid)) toAnonymiser.value = null
}
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Placement" description="Gérer les candidatures et les besoins des entreprises clientes." />

    <PlacementTabs />

    <CandidatureFilters
      v-model:search="searchInput"
      :statut="query.statut"
      :has-filters="hasFilters"
      @update:statut="(v) => setFilter('statut', v)"
      @reset="reset"
    />

    <AdminListState
      :state="list.state.value"
      message-vide="Aucune candidature reçue."
      message-vide-filtre="Aucune candidature ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <div :class="{ 'opacity-80 transition-opacity': list.refreshing.value }" :aria-busy="list.refreshing.value">
        <CandidaturesList
          :candidatures="list.items.value"
          :busy-uuid="actions.busyUuid.value"
          @statut="(candidature, statut) => actions.updateStatut(candidature.uuid, statut)"
          @vivier="(candidature) => (toVivier = candidature)"
          @anonymiser="(candidature) => (toAnonymiser = candidature)"
          @remove="(candidature) => (toDelete = candidature)"
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

    <CmsDeleteDialog
      v-model:open="deleteOpen"
      titre="Supprimer cette candidature ?"
      description="La candidature sera supprimée définitivement. Cette action est irréversible."
      :submitting="actions.submitting.value"
      @confirm="confirmDelete"
    />

    <Dialog v-model:open="vivierOuvert">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter au vivier ?</DialogTitle>
          <DialogDescription>
            Le profil sera ajouté au vivier et son CV copié. La candidature reste conservée.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="actions.submitting.value" @click="toVivier = null">Annuler</Button>
          <Button :disabled="actions.submitting.value" @click="confirmVivier">Ajouter au vivier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog v-model:open="anonymiserOuvert">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer les données personnelles ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les coordonnées, le message et les documents seront effacés et le CV supprimé du stockage.
            La candidature est conservée de façon anonyme, conformément à la Loi 25. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="actions.submitting.value">Annuler</AlertDialogCancel>
          <Button
            variant="destructive"
            class="min-h-11 md:min-h-9"
            :disabled="actions.submitting.value"
            @click="confirmAnonymiser"
          >
            Supprimer maintenant
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
