<script setup lang="ts">
// Onglet Demandes : besoins des clients, publication comme offre, affectations/candidats
// correspondants. Utilise `useAdminPagedList` avec requête mappée pour `publiee` (string).
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminDemandeDto } from '#shared/types/admin'
import { demandesQuerySchema, type DemandeCreateInput, type DemandeUpdateInput, type DemandesQuery } from '#shared/validation/placement'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import DemandeFilters from '@/components/admin/placement/DemandeFilters.vue'
import DemandeFormDialog from '@/components/admin/placement/DemandeFormDialog.vue'
import DemandesList from '@/components/admin/placement/DemandesList.vue'
import PlacementTabs from '@/components/admin/placement/PlacementTabs.vue'
import { useDemandeActions } from '@/components/admin/placement/useDemandeActions'
import CmsDeleteDialog from '@/components/cms/CmsDeleteDialog.vue'
import { Button } from '@/components/ui/button'
import {
  DEMANDE_FIELDS,
  OFFRE_FIELDS,
  demandeCreateFormSchema,
  demandeEditFormSchema,
  demandeInitialValues,
  offreFormSchema,
  offreInitialValues,
} from '@/config/admin-placement-fields'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'
import CmsFormDialog from '@/components/cms/CmsFormDialog.vue'
import type { OffreInput } from '@/components/admin/placement/useDemandeActions'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Placement — Demandes' })

const { query, searchInput, hasFilters, setFilter, setPage, reset } = useAdminListQuery<DemandesQuery>(demandesQuerySchema, [
  'statut',
  'publiee',
  'q',
  'page',
])

const listQuery = computed(() => {
  const q = query.value
  return {
    statut: q.statut,
    publiee: q.publiee === undefined ? undefined : String(q.publiee),
    q: q.q,
    page: q.page,
  } as Record<string, string | number | undefined>
})

const list = useAdminPagedList<AdminDemandeDto, Record<string, string | number | undefined>>({
  endpoint: '/api/admin/placement/demandes',
  query: listQuery,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

const actions = useDemandeActions(list.refresh)

type FormMode = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly demande: AdminDemandeDto }

const formMode = ref<FormMode>({ kind: 'create' })
const formOpen = ref(false)

const edited = computed(() => (formMode.value.kind === 'edit' ? formMode.value.demande : null))
// Une demande publiée expose aussi les champs d'offre dans le dialog d'édition : modifier le
// contenu d'une offre existante sans la dépublier (le backend valide et invalide l'ISR).
const formFields = computed(() => (edited.value?.publiee ? [...DEMANDE_FIELDS, ...OFFRE_FIELDS] : DEMANDE_FIELDS))
const formSchema = computed(() => (edited.value ? demandeEditFormSchema : demandeCreateFormSchema))
const formValues = computed(() => {
  const values = demandeInitialValues(edited.value)
  if (edited.value?.publiee) Object.assign(values, offreInitialValues(edited.value))
  return values
})
const formTitre = computed(() => (edited.value ? 'Modifier la demande' : 'Ajouter une demande'))

const publierCible = ref<AdminDemandeDto | null>(null)
const publierOuvert = computed({
  get: () => publierCible.value !== null,
  set: (open: boolean) => {
    if (!open && actions.submitting.value) return
    publierCible.value = open ? publierCible.value : null
  },
})
const publierSchema = offreFormSchema
const publierFields = OFFRE_FIELDS
const publierInitialValues = computed(() => offreInitialValues(publierCible.value))

function openCreate(): void {
  formMode.value = { kind: 'create' }
  formOpen.value = true
}

function openEdit(demande: AdminDemandeDto): void {
  formMode.value = { kind: 'edit', demande }
  formOpen.value = true
}

function onTogglePublication(demande: AdminDemandeDto, value: boolean): void {
  if (!value) {
    void actions.depublier(demande.uuid)
    return
  }
  publierCible.value = demande
  publierOuvert.value = true
}

async function onPublier(values: Record<string, unknown>): Promise<void> {
  const cible = publierCible.value
  if (!cible) return
  if (!(await actions.publier(cible.uuid, values as unknown as OffreInput))) return
  publierOuvert.value = false
}

function onFormOpen(open: boolean): void {
  if (!open && actions.submitting.value) return
  formOpen.value = open
}

async function onFormSubmit(values: Record<string, unknown>): Promise<void> {
  const demande = edited.value
  const done = demande
    ? await actions.update(demande.uuid, { ...values, ...(demande.publiee ? { publiee: true } : {}) } as DemandeUpdateInput)
    : await actions.create(values as DemandeCreateInput)
  if (done) formOpen.value = false
}

const toDelete = ref<AdminDemandeDto | null>(null)
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (open: boolean) => {
    if (!open && actions.submitting.value) return
    toDelete.value = open ? toDelete.value : null
  },
})
const deleteDescription = computed(() =>
  toDelete.value?.publiee
    ? 'Cette demande est publiée comme offre d’emploi : elle sera dépubliée du site public avant sa suppression définitive.'
    : 'La demande et ses affectations seront supprimées définitivement.',
)

async function confirmDelete(): Promise<void> {
  const target = toDelete.value
  if (!target) return
  if (await actions.remove(target.uuid)) toDelete.value = null
}
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Placement" description="Gérer les candidatures et les besoins des entreprises clientes.">
      <Button class="min-h-11 md:min-h-9" @click="openCreate">
        <Plus aria-hidden="true" />
        Ajouter une demande
      </Button>
    </AdminPageHeader>

    <PlacementTabs />

    <DemandeFilters
      v-model:search="searchInput"
      :statut="query.statut"
      :publiee="query.publiee === undefined ? undefined : String(query.publiee)"
      :has-filters="hasFilters"
      @update:statut="(v) => setFilter('statut', v)"
      @update:publiee="(v) => setFilter('publiee', v)"
      @reset="reset"
    />

    <AdminListState
      :state="list.state.value"
      message-vide="Aucune demande pour l'instant."
      message-vide-filtre="Aucune demande ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <template #vide-action>
        <Button class="min-h-11 md:min-h-9" @click="openCreate">Ajouter une demande</Button>
      </template>
      <div :class="{ 'opacity-80 transition-opacity': list.refreshing.value }" :aria-busy="list.refreshing.value">
        <DemandesList
          :demandes="list.items.value"
          :busy-uuid="actions.busyUuid.value"
          @edit="openEdit"
          @remove="(demande) => (toDelete = demande)"
          @statut="(demande, statut) => actions.updateStatut(demande.uuid, statut)"
          @toggle-publication="onTogglePublication"
          @assign="(demande, candidatUuid) => actions.assigner(demande.uuid, candidatUuid)"
          @retire="(demande, affectationUuid) => actions.retirerAffectation(demande.uuid, affectationUuid)"
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

    <DemandeFormDialog
      :open="formOpen"
      :titre="formTitre"
      :fields="formFields"
      :schema="formSchema"
      :initial-values="formValues"
      :submitting="actions.submitting.value"
      @update:open="onFormOpen"
      @submit="onFormSubmit"
    />

    <CmsFormDialog
      v-model:open="publierOuvert"
      titre="Publier comme offre d'emploi"
      description="Le poste deviendra visible sur la page des offres du site Placement."
      :fields="publierFields"
      :schema="publierSchema"
      :initial-values="publierInitialValues"
      site-uuid=""
      :submitting="actions.submitting.value"
      @submit="onPublier"
    />

    <CmsDeleteDialog
      v-model:open="deleteOpen"
      titre="Supprimer cette demande ?"
      :description="deleteDescription"
      :submitting="actions.submitting.value"
      @confirm="confirmDelete"
    />
  </div>
</template>
