<script setup lang="ts">
// Dossiers clients du module comptable. Liste en lignes (parité prototype), filtre statut,
// création/édition par dialog, suppression confirmée. Compteur global « en retard ».
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { ADMIN_PAGE_SIZE, STATUT_DOSSIER_LABELS } from '#shared/config/admin'
import type { AdminDossierComptableDto, AdminDossiersPageDto } from '#shared/types/admin'
import {
  dossiersQuerySchema,
  type DossierCreateInput,
  type DossierUpdateInput,
  type DossiersQuery,
} from '#shared/validation/comptable'
import AdminFilterSelect from '@/components/admin/AdminFilterSelect.vue'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import CmsDeleteDialog from '@/components/cms/CmsDeleteDialog.vue'
import { Button } from '@/components/ui/button'
import DossierFormDialog from '@/components/admin/comptable/DossierFormDialog.vue'
import DossiersList from '@/components/admin/comptable/DossiersList.vue'
import { useDossierActions } from '@/components/admin/comptable/useDossierActions'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'
import {
  DOSSIER_FIELDS,
  dossierCreateFormSchema,
  dossierEditFormSchema,
  dossierInitialValues,
} from '@/config/admin-comptable-fields'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Comptable — Dossiers clients' })

const { query, hasFilters, setFilter, setPage, reset } = useAdminListQuery<DossiersQuery>(dossiersQuerySchema, [
  'statut',
  'page',
])

const list = useAdminPagedList<AdminDossierComptableDto, DossiersQuery, AdminDossiersPageDto>({
  endpoint: '/api/admin/comptable/dossiers',
  query,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

// Bandeau : total global + dossiers en retard (compteur serveur, indépendant du filtre/page).
const enRetard = computed(() => list.data.value?.enRetard ?? 0)
const compteur = computed(() => `${list.total.value} dossier${list.total.value > 1 ? 's' : ''} · ${enRetard.value} en retard`)

const actions = useDossierActions(list.refresh)

const statutOptions = Object.entries(STATUT_DOSSIER_LABELS).map(([value, label]) => ({ value, label }))

type FormMode = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly dossier: AdminDossierComptableDto }

const formMode = ref<FormMode>({ kind: 'create' })
const formOpen = ref(false)

const edited = computed(() => (formMode.value.kind === 'edit' ? formMode.value.dossier : null))
const formFields = computed(() => DOSSIER_FIELDS)
const formSchema = computed(() => (edited.value ? dossierEditFormSchema : dossierCreateFormSchema))
const formValues = computed(() => dossierInitialValues(edited.value))
const formServerErrors = computed(() => (actions.emailError.value ? { email: actions.emailError.value } : undefined))
const formTitre = computed(() => (edited.value ? 'Modifier le dossier' : 'Nouveau dossier'))

function openCreate(): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'create' }
  formOpen.value = true
}

function openEdit(dossier: AdminDossierComptableDto): void {
  actions.clearFieldErrors()
  formMode.value = { kind: 'edit', dossier }
  formOpen.value = true
}

function onFormOpen(open: boolean): void {
  if (!open && actions.submitting.value) return
  formOpen.value = open
}

async function onFormSubmit(values: Record<string, unknown>): Promise<void> {
  const dossier = edited.value
  const done = dossier
    ? await actions.update(dossier.uuid, values as DossierUpdateInput)
    : await actions.create(values as DossierCreateInput)
  if (done) formOpen.value = false
}

const toDelete = ref<AdminDossierComptableDto | null>(null)
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
    <AdminPageHeader titre="Dossiers clients" :description="compteur">
      <Button class="min-h-11 md:min-h-9" @click="openCreate">
        <Plus aria-hidden="true" />
        Ajouter
      </Button>
    </AdminPageHeader>

    <div class="flex flex-wrap items-end gap-3">
      <AdminFilterSelect
        v-model="query.statut"
        label="Statut"
        tout-label="Tous les statuts"
        :options="statutOptions"
        @update:model-value="(v) => setFilter('statut', v)"
      />
      <Button v-if="hasFilters" variant="ghost" class="min-h-11 md:min-h-9" @click="reset">Réinitialiser</Button>
    </div>

    <AdminListState
      :state="list.state.value"
      message-vide="Aucun dossier."
      message-vide-filtre="Aucun dossier ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <template #vide-action>
        <Button class="min-h-11 md:min-h-9" @click="openCreate">Ajouter un dossier</Button>
      </template>
      <div :class="{ 'opacity-80 transition-opacity': list.refreshing.value }" :aria-busy="list.refreshing.value">
        <DossiersList
          :dossiers="list.items.value"
          busy-uuid=""
          @edit="openEdit"
          @remove="(dossier) => (toDelete = dossier)"
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

    <DossierFormDialog
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
      titre="Supprimer ce dossier ?"
      description="Cette action est définitive. Le profil client reste dans le carnet CRM."
      :submitting="actions.submitting.value"
      @confirm="confirmDelete"
    />
  </div>
</template>
