<script setup lang="ts">
// Messages reçus via les formulaires publics : lecture, changement de statut, conversion en
// client, suppression. Filtres et page vivent dans l'URL.
import { computed, ref } from 'vue'
import { messagesQuerySchema, type MessagesQuery } from '#shared/validation/admin'
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminMessageDto } from '#shared/types/admin'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import MessageFilters from '@/components/admin/messages/MessageFilters.vue'
import MessageItem from '@/components/admin/messages/MessageItem.vue'
import { useMessageActions } from '@/components/admin/messages/useMessageActions'
import CmsDeleteDialog from '@/components/cms/CmsDeleteDialog.vue'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

useHead({ title: 'Messages — Administration' })

const { sites, refreshCompteurs } = useAdminShell()

const { query, searchInput, hasFilters, setFilter, setPage, reset } = useAdminListQuery<MessagesQuery>(messagesQuerySchema, [
  'site',
  'type',
  'statut',
  'q',
  'page',
])

const list = useAdminPagedList<AdminMessageDto, MessagesQuery>({
  endpoint: '/api/admin/messages',
  query,
  filtered: hasFilters,
  onPageOutOfRange: (lastPage) => void setPage(lastPage),
})

const actions = useMessageActions(async () => {
  await Promise.all([list.refresh(), refreshCompteurs()])
})

const showSite = computed(() => sites.value.length > 1)

const toDelete = ref<AdminMessageDto | null>(null)
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (open: boolean) => {
    if (!open && actions.busyUuid.value === null) toDelete.value = null
  },
})

async function confirmDelete(): Promise<void> {
  const target = toDelete.value
  if (!target) return
  const deleted = await actions.remove(target.uuid)
  if (deleted) toDelete.value = null
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-6">
    <AdminPageHeader titre="Messages" description="Demandes reçues depuis les formulaires des sites." />

    <MessageFilters
      v-model:search="searchInput"
      :sites="sites"
      :site="query.site"
      :type="query.type"
      :statut="query.statut"
      :has-filters="hasFilters"
      @update:site="(v) => setFilter('site', v)"
      @update:type="(v) => setFilter('type', v)"
      @update:statut="(v) => setFilter('statut', v)"
      @reset="reset"
    />

    <AdminListState
      :state="list.state.value"
      message-vide="Aucun message."
      message-vide-filtre="Aucun message ne correspond à ces filtres."
      :message-erreur="list.error.value?.message"
      @retry="list.refresh"
      @reset="reset"
    >
      <div :class="{ 'opacity-60 transition-opacity': list.refreshing.value }">
        <MessageItem
          v-for="message in list.items.value"
          :key="message.uuid"
          :message="message"
          :busy="actions.busyUuid.value === message.uuid"
          :show-site="showSite"
          @statut="(statut) => actions.updateStatut(message.uuid, statut)"
          @add-client="actions.addToClients(message.uuid)"
          @remove="toDelete = message"
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
      titre="Supprimer ce message ?"
      description="Le message sera supprimé définitivement. Cette action est irréversible."
      :submitting="actions.busyUuid.value !== null"
      @confirm="confirmDelete"
    />
  </div>
</template>
