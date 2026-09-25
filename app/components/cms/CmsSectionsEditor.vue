<script setup lang="ts">
// Éditeur des sections éditoriales d'un site (spec phase 2 §4.5). Contrairement aux
// collections : pas de création, pas de suppression, pas de réordonnancement — le catalogue
// (shared/content/sections/catalog.ts) est la seule source des clés ; seules les valeurs
// (`donnees`) sont éditées ici, avec le schéma zod du type déclaré pour cette clé.
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Pencil } from '@lucide/vue'
import { PAGE_SITE, trouverEntreeCatalogue, type PageSiteKey } from '#shared/content/sections/catalog'
import { sectionTypeDefinition } from '#shared/content/sections/types'
import type { SiteSlug } from '#shared/config/sites'
import type { CmsSectionDto } from '#shared/types/cms'
import { useAdminResource } from '@/composables/useAdminResource'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import CmsFormDialog from './CmsFormDialog.vue'

const props = defineProps<{
  siteSlug: SiteSlug
  siteUuid: string
}>()

const PAGE_LABELS: Record<PageSiteKey, string> = {
  COMMUN: 'Commun',
  ACCUEIL: 'Accueil',
  SERVICES: 'Services',
  REALISATIONS: 'Réalisations',
  A_PROPOS: 'À propos',
  CONTACT: 'Contact',
  RESTAURANT: 'Restaurant',
  OFFRES: 'Offres',
  CONFIDENTIALITE: 'Confidentialité',
  MENTIONS_LEGALES: 'Mentions légales',
}

const PAGE_ORDER: readonly PageSiteKey[] = Object.values(PAGE_SITE)

interface UpdateSectionPayload {
  readonly donnees: Record<string, unknown>
}

const { items, status, error, refresh, update } = useAdminResource<CmsSectionDto, never, UpdateSectionPayload>({
  endpoint: '/api/admin/contenu/sections',
  site: () => props.siteSlug,
})

const groupedByPage = computed(() => {
  const map = new Map<PageSiteKey, CmsSectionDto[]>()
  for (const item of items.value) {
    const list = map.get(item.page) ?? []
    list.push(item)
    map.set(item.page, list)
  }
  return PAGE_ORDER.filter((page) => map.has(page)).map((page) => ({ page, entries: map.get(page) ?? [] }))
})

function summarize(donnees: Record<string, unknown>): string | null {
  const candidate = donnees.titre ?? donnees.texte ?? donnees.title ?? donnees.description
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

const editing = ref<CmsSectionDto | null>(null)
const formSubmitting = ref(false)

const editingType = computed(() => (editing.value ? trouverEntreeCatalogue(editing.value.page, editing.value.cle)?.type : undefined))
const editingDefinition = computed(() => (editingType.value ? sectionTypeDefinition(editingType.value) : null))

function openEdit(item: CmsSectionDto): void {
  editing.value = item
}

function onOpenChange(value: boolean): void {
  if (!value) editing.value = null
}

async function handleSubmit(values: Record<string, unknown>): Promise<void> {
  const target = editing.value
  if (!target) return
  formSubmitting.value = true
  try {
    await update(target.uuid, { donnees: values })
    toast.success('Section mise à jour.')
    editing.value = null
  } catch (e) {
    toast.error((e as { message: string }).message)
  } finally {
    formSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="max-w-2xl text-sm text-muted-foreground">
      Textes affichés sur le site public. Utilisez <code class="rounded bg-muted px-1 py-0.5">*mot*</code> pour accentuer un
      segment, et <code class="rounded bg-muted px-1 py-0.5">{groupe}</code> / <code class="rounded bg-muted px-1 py-0.5">{nomCourt}</code>
      pour insérer le nom du groupe ou de la filiale.
    </p>

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
      <p class="text-sm text-muted-foreground">Aucune section pour ce site.</p>
    </div>

    <template v-else>
      <section v-for="group in groupedByPage" :key="group.page" class="space-y-3">
        <h3 class="font-display text-lg font-semibold text-navy">{{ PAGE_LABELS[group.page] }}</h3>
        <ul class="overflow-hidden rounded-lg border border-border bg-card">
          <li
            v-for="entry in group.entries"
            :key="entry.uuid"
            class="grid grid-cols-1 gap-3 border-t border-border px-5 py-4 first:border-t-0 md:grid-cols-[auto_1fr_auto] md:items-center"
          >
            <span class="w-fit rounded border border-border px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {{ entry.cle }}
            </span>
            <div class="min-w-0">
              <p v-if="summarize(entry.donnees)" class="line-clamp-1 text-sm font-medium text-foreground">
                {{ summarize(entry.donnees) }}
              </p>
              <p class="text-xs text-muted-foreground">
                Modifié le {{ new Date(entry.updatedAt).toLocaleDateString('fr-CA') }}
              </p>
            </div>
            <Button variant="outline" size="sm" class="gap-1.5 justify-self-start md:justify-self-end" @click="openEdit(entry)">
              <Pencil class="size-3.5" aria-hidden="true" /> Modifier
            </Button>
          </li>
        </ul>
      </section>
    </template>

    <CmsFormDialog
      v-if="editing && editingDefinition"
      :open="editing !== null"
      titre="Modifier la section"
      :description="`${PAGE_LABELS[editing.page]} · ${editing.cle}`"
      :fields="editingDefinition.fields"
      :schema="editingDefinition.schema"
      :initial-values="editing.donnees"
      :site-uuid="siteUuid"
      :submitting="formSubmitting"
      @update:open="onOpenChange"
      @submit="handleSubmit"
    />
  </div>
</template>
