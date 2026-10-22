<script setup lang="ts">
// Onglet Candidats (vivier). Filtres + liste + création/modification + suppression. Les
// anonymisations ne sont pas réalisées ici (elles concernent les candidatures).
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminCandidatDto } from '#shared/types/admin'
import { candidatsQuerySchema, type CandidatCreateInput, type CandidatUpdateInput, type CandidatsQuery } from '#shared/validation/placement'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import CandidatFilters from '@/components/admin/placement/CandidatFilters.vue'
import CandidatFormDialog from '@/components/admin/placement/CandidatFormDialog.vue'
import CandidatsList from '@/components/admin/placement/CandidatsList.vue'
import PlacementTabs from '@/components/admin/placement/PlacementTabs.vue'
import { useCandidatActions } from '@/components/admin/placement/useCandidatActions'
import CmsDeleteDialog from '@/components/cms/CmsDeleteDialog.vue'
import { Button } from '@/components/ui/button'
import {
  CANDIDAT_FIELDS,
  candidatCreateFormSchema,
  candidatEditFormSchema,
  candidatInitialValues,
} from '@/config/admin-placement-fields'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Placement — Candidats' })

const { query, searchInput, hasFilters, setFilter, setPage, reset } = useAdminListQuery<CandidatsQuery>(candidatsQuerySchema, [
  'statut',
  'origine',
  'q',
  'page',
])

const list = useAdminPagedList<AdminCandidatDto, CandidatsQuery>({
  endpoint: '/api/admin/placement/candidats',
  query,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

const actions = useCandidatActions(list.refresh)

type FormMode = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly candidat: AdminCandidatDto }

const formMode = ref<FormMode>({ kind: 'create' })
const formOpen = ref(false)

const edited = computed(() => (formMode.value.kind === 'edit' ? formMode.value.candidat : null))
const formFields = computed(() => CANDIDAT_FIELDS)
const formSchema = computed(() => (edited.value ? candidatEditFormSchema : candidatCreateFormSchema))
const formValues = computed(() => candidatInitialValues(edited.value))
const formServerErrors = computed(() => (actions.emailError.value ? { email: actions.emailError.value } : undefined))
const formTitre = computed(() => (edited.value ? 'Modifier le candidat' : 'Ajouter un candidat'))

function openCreate(): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'create' }
  formOpen.value = true
}

function openEdit(candidat: AdminCandidatDto): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'edit', candidat }
  formOpen.value = true
}

function onFormOpen(open: boolean): void {
  if (!open && actions.submitting.value) return
  formOpen.value = open
}

async function onFormSubmit(values: Record<string, unknown>): Promise<void> {
  const candidat = edited.value
  const done = candidat
    ? await actions.update(candidat.uuid, values as CandidatUpdateInput)
    : await actions.create(values as CandidatCreateInput)
  if (done) formOpen.value = false
}

const toDelete = ref<AdminCandidatDto | null>(null)
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
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Placement" description="Gérer les candidatures et les besoins des entreprises clientes.">
      <Button class="min-h-11 md:min-h-9" @click="openCreate">
        <Plus aria-hidden="true" />
        Ajouter un candidat
      </Button>
    </AdminPageHeader>

    <PlacementTabs />

    <CandidatFilters
      v-model:search="searchInput"
      :statut="query.statut"
      :origine="query.origine"
      :has-filters="hasFilters"
      @update:statut="(v) => setFilter('statut', v)"
      @update:origine="(v) => setFilter('origine', v)"
      @reset="reset"
    />

    <AdminListState
      :state="list.state.value"
      message-vide="Aucun candidat dans le vivier."
      message-vide-filtre="Aucun candidat ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <template #vide-action>
        <Button class="min-h-11 md:min-h-9" @click="openCreate">Ajouter un candidat</Button>
      </template>
      <div :class="{ 'opacity-80 transition-opacity': list.refreshing.value }" :aria-busy="list.refreshing.value">
        <CandidatsList
          :candidats="list.items.value"
          :busy-uuid="actions.busyUuid.value"
          @edit="openEdit"
          @remove="(candidat) => (toDelete = candidat)"
          @statut="(candidat, statut) => actions.updateStatut(candidat.uuid, statut)"
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

    <CandidatFormDialog
      :open="formOpen"
      :titre="formTitre"
      :fields="formFields"
      :schema="formSchema"
      :initial-values="formValues"
      :submitting="actions.submitting.value"
      :server-errors="formServerErrors"
      @update:open="onFormOpen"
      @submit="onFormSubmit"
    />

    <CmsDeleteDialog
      v-model:open="deleteOpen"
      titre="Supprimer ce candidat ?"
      description="Le profil et les éventuels documents associés seront supprimés définitivement."
      :submitting="actions.submitting.value"
      @confirm="confirmDelete"
    />
  </div>
</template>
