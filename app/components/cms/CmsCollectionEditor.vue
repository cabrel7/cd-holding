<script setup lang="ts" generic="TItem extends CmsItemBase, TForm extends Record<string, unknown>">
// Éditeur CMS générique pour une collection (services, réalisations, équipe, partenaires) —
// spec phase 2 §4.5. Autonome : consomme useAdminResource lui-même, pas d'emits. Le site à
// gérer est choisi une fois (sélecteur si SUPER_ADMIN a plusieurs sites), pour que la liste,
// le réordonnancement et la création restent toujours scopés à un site sans ambiguïté.
// Listes éditoriales courtes volontairement non paginées : réordonnancement nécessite la liste complète.
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@lucide/vue'
import type { SiteSlug } from '#shared/config/sites'
import type { AdminSiteSummary } from '#shared/types/admin'
import type { CmsItemBase } from '#shared/types/cms'
import type { CmsResourceConfig } from '@/config/cms-resources'
import { useAdminResource } from '@/composables/useAdminResource'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import CmsDeleteDialog from './CmsDeleteDialog.vue'
import CmsFormDialog from './CmsFormDialog.vue'
import CmsImageThumbnail from './CmsImageThumbnail.vue'
import { isAdminUnauthorized, watchAdminUnauthorized } from '@/utils/admin-unauthorized'

const props = defineProps<{
  config: CmsResourceConfig<TItem, TForm>
}>()

// --- Sites accessibles (scopés côté serveur ; filtrés côté client par allowHolding) ---
const { data: sitesData, status: sitesStatus, error: sitesError } = await useFetch<AdminSiteSummary[]>('/api/admin/sites', {
  server: false,
  key: 'admin-sites',
  default: () => [] as AdminSiteSummary[],
})
watchAdminUnauthorized(sitesError)

const availableSites = computed<AdminSiteSummary[]>(() => {
  const sites = sitesData.value ?? []
  return props.config.allowHolding ? sites : sites.filter((s) => s.type !== 'HOLDING')
})

const selectedSiteSlug = ref<SiteSlug | undefined>(undefined)

watch(
  availableSites,
  (sites) => {
    const stillValid = sites.some((s) => s.slug === selectedSiteSlug.value)
    if (!stillValid) {
      selectedSiteSlug.value = sites[0]?.slug
    }
  },
  { immediate: true },
)

const selectedSite = computed<AdminSiteSummary | null>(
  () => availableSites.value.find((s) => s.slug === selectedSiteSlug.value) ?? null,
)

// --- Collection du site sélectionné ---
const { items, status, error, refresh, create, update, remove, reorder } = useAdminResource<TItem, TForm>({
  endpoint: props.config.endpoint,
  site: () => selectedSiteSlug.value,
})

// --- Formulaire (création / édition) ---
const formOpen = ref(false)
const formSubmitting = ref(false)
const editingItem = ref<TItem | null>(null)

const formInitialValues = computed(() => props.config.toForm(editingItem.value))
const formSchema = computed(() => (editingItem.value ? props.config.updateSchema : props.config.createSchema))
const formTitre = computed(() => (editingItem.value ? 'Modifier la fiche' : props.config.libelles.ajouter))

function openCreate(): void {
  editingItem.value = null
  formOpen.value = true
}

function openEdit(item: TItem): void {
  editingItem.value = item
  formOpen.value = true
}

function onFormOpenChange(value: boolean): void {
  formOpen.value = value
  if (!value) editingItem.value = null
}

async function handleSubmit(values: Record<string, unknown>): Promise<void> {
  if (!selectedSite.value) return
  formSubmitting.value = true
  try {
    if (editingItem.value) {
      await update(editingItem.value.uuid, values as Partial<TForm>)
      toast.success('Fiche mise à jour.')
    } else {
      await create({ ...values, site: selectedSite.value.slug } as unknown as TForm)
      toast.success('Fiche ajoutée.')
    }
    formOpen.value = false
    editingItem.value = null
  } catch (e) {
    // 401 : la redirection est déjà déclenchée par `watchAdminUnauthorized(mutationError)`
    // dans useAdminResource — pas de toast en plus (motif des handlers).
    if (isAdminUnauthorized(e)) return
    toast.error((e as { message: string }).message)
  } finally {
    formSubmitting.value = false
  }
}

// --- Suppression ---
const deleteTarget = ref<TItem | null>(null)
const deleteSubmitting = ref(false)

function requestDelete(item: TItem): void {
  deleteTarget.value = item
}

function onDeleteDialogOpenChange(value: boolean): void {
  // Le dialog ne se ferme jamais tout seul pendant la requête (bouton Annuler
  // désactivé, Echap intercepté côté CmsDeleteDialog) ; ce garde est une
  // sécurité supplémentaire pour ne jamais perdre la cible en cours de suppression.
  if (deleteSubmitting.value) return
  if (!value) deleteTarget.value = null
}

async function handleDelete(): Promise<void> {
  // La cible est capturée ici, indépendamment de tout événement de fermeture du
  // dialog : le dialog ne se ferme plus automatiquement au clic sur « Supprimer »
  // (CmsDeleteDialog n'utilise plus AlertDialogAction), donc deleteTarget ne peut
  // pas avoir été remis à null avant l'exécution de ce handler.
  const target = deleteTarget.value
  if (!target) return
  deleteSubmitting.value = true
  try {
    await remove(target.uuid)
    toast.success('Fiche supprimée.')
    deleteTarget.value = null
  } catch (e) {
    // On laisse le dialog ouvert (cible conservée) pour permettre de réessayer
    // sans avoir à resélectionner la fiche ; l'utilisateur peut aussi l'annuler.
    if (isAdminUnauthorized(e)) return
    toast.error((e as { message: string }).message)
  } finally {
    deleteSubmitting.value = false
  }
}

// --- Réordonnancement (clavier : boutons monter/descendre) ---
const reordering = ref(false)

async function move(item: TItem, direction: -1 | 1): Promise<void> {
  const list = items.value
  const index = list.findIndex((i) => i.uuid === item.uuid)
  const target = index + direction
  if (index === -1 || target < 0 || target >= list.length) return
  const next = [...list]
  const current = next[index]
  const swapped = next[target]
  if (!current || !swapped) return
  next[index] = swapped
  next[target] = current
  reordering.value = true
  try {
    await reorder(next.map((i) => i.uuid))
  } catch (e) {
    if (isAdminUnauthorized(e)) return
    toast.error((e as { message: string }).message)
  } finally {
    reordering.value = false
  }
}

// --- Mise en avant (interrupteur, services) ---
const togglingUuid = ref<string | null>(null)

function toggleValue(item: TItem): boolean {
  const toggle = props.config.toggle
  if (!toggle) return false
  return (item as unknown as Record<string, unknown>)[toggle.field] === true
}

const featuredCount = computed(() => {
  const toggle = props.config.toggle
  if (!toggle) return 0
  return items.value.filter((item) => toggleValue(item)).length
})

function toggleDisabled(item: TItem): boolean {
  const toggle = props.config.toggle
  if (!toggle) return true
  if (togglingUuid.value === item.uuid) return true
  if (toggleValue(item)) return false
  return toggle.max !== undefined && featuredCount.value >= toggle.max
}

async function toggleFeatured(item: TItem): Promise<void> {
  const toggle = props.config.toggle
  if (!toggle) return
  togglingUuid.value = item.uuid
  try {
    await update(item.uuid, { [toggle.field]: !toggleValue(item) } as unknown as Partial<TForm>)
  } catch (e) {
    if (isAdminUnauthorized(e)) return
    toast.error((e as { message: string }).message)
  } finally {
    togglingUuid.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        <h2 class="font-display text-2xl font-semibold text-navy">{{ config.libelles.titre }}</h2>
        <p class="mt-1 max-w-xl text-sm text-muted-foreground">{{ config.libelles.description }}</p>
      </div>
      <div class="flex items-center gap-2">
        <Select
          v-if="availableSites.length > 1"
          :model-value="selectedSiteSlug"
          @update:model-value="(v) => (selectedSiteSlug = v as SiteSlug)"
        >
          <SelectTrigger class="w-56" aria-label="Site à gérer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="site in availableSites" :key="site.uuid" :value="site.slug">
              {{ site.nomCourt ?? site.nom }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button :disabled="!selectedSite" class="gap-1.5" @click="openCreate">
          <Plus class="size-4" aria-hidden="true" /> {{ config.libelles.ajouter }}
        </Button>
      </div>
    </header>

    <div v-if="sitesStatus === 'pending'" class="space-y-2">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-16 w-full" />
    </div>

    <template v-else-if="selectedSite">
      <div v-if="status === 'pending'" class="space-y-2" role="status" aria-label="Chargement">
        <Skeleton class="h-16 w-full" />
        <Skeleton class="h-16 w-full" />
        <Skeleton class="h-16 w-full" />
      </div>

      <div v-else-if="status === 'error'" class="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-6 text-sm">
        <p class="text-destructive">{{ error?.message ?? 'Une erreur est survenue.' }}</p>
        <Button variant="outline" size="sm" class="mt-3" @click="refresh()">Réessayer</Button>
      </div>

      <div v-else-if="items.length === 0" class="rounded-lg border border-dashed border-border px-5 py-10 text-center">
        <p class="text-sm text-muted-foreground">{{ config.libelles.vide }}</p>
        <Button variant="outline" size="sm" class="mt-3 gap-1.5" @click="openCreate">
          <Plus class="size-4" aria-hidden="true" /> {{ config.libelles.ajouter }}
        </Button>
      </div>

      <ul v-else class="overflow-hidden rounded-lg border border-border bg-card">
        <li
          v-for="(item, index) in items"
          :key="item.uuid"
          class="grid grid-cols-1 gap-3 border-t border-border px-5 py-4 first:border-t-0 md:grid-cols-[auto_1fr_auto_auto] md:items-center"
        >
          <CmsImageThumbnail :image-key="config.imageKey(item)" :alt="config.primary(item)" />

          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-foreground">{{ config.primary(item) }}</p>
            <p v-if="config.secondary(item)" class="line-clamp-2 text-xs text-muted-foreground">{{ config.secondary(item) }}</p>
          </div>

          <div v-if="config.toggle" class="flex items-center gap-2 justify-self-start md:justify-self-center">
            <Switch
              :model-value="toggleValue(item)"
              :disabled="toggleDisabled(item)"
              :aria-label="`${config.toggle.label} — ${config.primary(item)}`"
              @update:model-value="() => toggleFeatured(item)"
            />
            <span class="text-xs text-muted-foreground">{{ config.toggle.label }}</span>
          </div>
          <div v-else />

          <div class="flex items-center gap-1 justify-self-start md:justify-self-end">
            <Button
              v-if="config.reorderable"
              variant="ghost"
              size="sm"
              :disabled="index === 0 || reordering"
              :aria-label="`Monter « ${config.primary(item)} »`"
              @click="move(item, -1)"
            >
              <ArrowUp class="size-4" aria-hidden="true" />
            </Button>
            <Button
              v-if="config.reorderable"
              variant="ghost"
              size="sm"
              :disabled="index === items.length - 1 || reordering"
              :aria-label="`Descendre « ${config.primary(item)} »`"
              @click="move(item, 1)"
            >
              <ArrowDown class="size-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" class="gap-1.5" @click="openEdit(item)">
              <Pencil class="size-3.5" aria-hidden="true" /> Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="requestDelete(item)"
            >
              <Trash2 class="size-3.5" aria-hidden="true" /> Supprimer
            </Button>
          </div>
        </li>
      </ul>
    </template>

    <CmsFormDialog
      v-if="selectedSite"
      :open="formOpen"
      :titre="formTitre"
      :fields="config.fields"
      :schema="formSchema"
      :initial-values="formInitialValues"
      :site-uuid="selectedSite.uuid"
      :submitting="formSubmitting"
      @update:open="onFormOpenChange"
      @submit="handleSubmit"
    />

    <CmsDeleteDialog
      :open="deleteTarget !== null"
      :submitting="deleteSubmitting"
      @update:open="onDeleteDialogOpenChange"
      @confirm="handleDelete"
    />
  </div>
</template>
