<script setup lang="ts">
// Clients de la filiale (ou de toutes pour le super administrateur) : liste filtrable,
// création, modification, suppression. Filtres et page vivent dans l'URL.
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminClientDto } from '#shared/types/admin'
import { clientsQuerySchema, type ClientCreateInput, type ClientUpdateInput, type ClientsQuery } from '#shared/validation/admin'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import ClientFilters from '@/components/admin/clients/ClientFilters.vue'
import ClientsList from '@/components/admin/clients/ClientsList.vue'
import { useClientActions } from '@/components/admin/clients/useClientActions'
import CmsDeleteDialog from '@/components/cms/CmsDeleteDialog.vue'
import CmsFormDialog from '@/components/cms/CmsFormDialog.vue'
import { Button } from '@/components/ui/button'
import {
  clientCreateFormSchema,
  clientEditFormSchema,
  clientFields,
  clientInitialValues,
} from '@/config/admin-client-fields'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Clients — Administration' })

const authStore = useAuthStore()
const { sites } = useAdminShell()

const { query, searchInput, hasFilters, setFilter, setPage, reset } = useAdminListQuery<ClientsQuery>(clientsQuerySchema, [
  'site',
  'statut',
  'q',
  'page',
])

const list = useAdminPagedList<AdminClientDto, ClientsQuery>({
  endpoint: '/api/admin/clients',
  query,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

const actions = useClientActions(list.refresh)

const showSite = computed(() => sites.value.length > 1)
const isSuperAdmin = computed(() => authStore.user?.role === ROLES.SUPER_ADMIN)

// --- formulaire (création ou édition) ---
type FormMode = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly client: AdminClientDto }

const formMode = ref<FormMode>({ kind: 'create' })
const formOpen = ref(false)

const editedClient = computed(() => (formMode.value.kind === 'edit' ? formMode.value.client : null))
const formWithSite = computed(() => formMode.value.kind === 'create' && isSuperAdmin.value)
const formFields = computed(() =>
  clientFields({
    withSite: formWithSite.value,
    sites: sites.value,
    emailOptionnel: editedClient.value !== null && editedClient.value.email === null,
  }),
)
const formSchema = computed(() =>
  editedClient.value
    ? clientEditFormSchema(editedClient.value.email === null)
    : clientCreateFormSchema(formWithSite.value),
)
const formValues = computed(() => clientInitialValues(editedClient.value, formWithSite.value))
const formServerErrors = computed(() => (actions.emailError.value ? { email: actions.emailError.value } : undefined))
const formTitre = computed(() => (editedClient.value ? 'Modifier le client' : 'Ajouter un client'))

function openCreate(): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'create' }
  formOpen.value = true
}

function openEdit(client: AdminClientDto): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'edit', client }
  formOpen.value = true
}

function onFormOpen(open: boolean): void {
  if (!open && actions.submitting.value) return
  formOpen.value = open
}

async function onFormSubmit(values: Record<string, unknown>): Promise<void> {
  const client = editedClient.value
  const done = client
    ? await actions.update(client.uuid, values as ClientUpdateInput)
    : await actions.create(values as ClientCreateInput)
  if (done) formOpen.value = false
}

// --- suppression ---
const toDelete = ref<AdminClientDto | null>(null)
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (open: boolean) => {
    if (!open && !actions.submitting.value) toDelete.value = null
  },
})
const deleteDescription = computed(() =>
  toDelete.value?.aDossier
    ? 'Ce client a un dossier comptable : il sera supprimé avec lui, définitivement.'
    : 'Le client sera supprimé définitivement. Cette action est irréversible.',
)

async function confirmDelete(): Promise<void> {
  const target = toDelete.value
  if (!target) return
  if (await actions.remove(target.uuid)) toDelete.value = null
}
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Clients" description="Prospects et clients de vos sites.">
      <Button class="min-h-11 md:min-h-9" @click="openCreate">
        <Plus aria-hidden="true" />
        Ajouter un client
      </Button>
    </AdminPageHeader>

    <ClientFilters
      v-model:search="searchInput"
      :sites="sites"
      :site="query.site"
      :statut="query.statut"
      :has-filters="hasFilters"
      @update:site="(v) => setFilter('site', v)"
      @update:statut="(v) => setFilter('statut', v)"
      @reset="reset"
    />

    <AdminListState
      :state="list.state.value"
      message-vide="Aucun client pour l'instant."
      message-vide-filtre="Aucun client ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <template #vide-action>
        <Button class="min-h-11 md:min-h-9" @click="openCreate">Ajouter un client</Button>
      </template>
      <div :class="{ 'opacity-80 transition-opacity': list.refreshing.value }" :aria-busy="list.refreshing.value">
        <ClientsList
          :clients="list.items.value"
          :show-site="showSite"
          @edit="openEdit"
          @remove="(client) => (toDelete = client)"
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

    <CmsFormDialog
      :open="formOpen"
      :titre="formTitre"
      :fields="formFields"
      :schema="formSchema"
      :initial-values="formValues"
      site-uuid=""
      :submitting="actions.submitting.value"
      :server-errors="formServerErrors"
      @update:open="onFormOpen"
      @submit="onFormSubmit"
    />

    <CmsDeleteDialog
      v-model:open="deleteOpen"
      titre="Supprimer ce client ?"
      :description="deleteDescription"
      :submitting="actions.submitting.value"
      @confirm="confirmDelete"
    />
  </div>
</template>
