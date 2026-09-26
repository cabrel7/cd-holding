<script setup lang="ts">
// Fiche de la société ("Site") — /admin/contenu/site (spec phase 3 §5, T3). Ressource
// singleton par site (GET/PATCH /api/admin/sites/[uuid]), contrairement aux Sections/Collections
// qui sont des listes filtrables par site : `useAdminResource` (conçu pour une liste + une
// requête filtrée côté serveur, voir CmsSectionsEditor) ne convient pas ici sans mentir sur le
// type — `GET /api/admin/sites` (liste, utilisée seulement pour le sélecteur) ne renvoie que le
// résumé (`AdminSiteSummary`), jamais `secteur`/`description`/etc. On réutilise donc son
// infrastructure d'erreurs (`toAdminError`) et le motif de sélecteur de site de
// contenu/index.vue ; le GET/PATCH du détail est écrit directement ci-dessous, sur le même
// modèle que CmsImageField.vue (état local + `$fetch` + try/catch/finally).
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Pencil } from '@lucide/vue'
import type { SiteSlug } from '#shared/config/sites'
import type { AdminError, AdminSiteReglages, AdminSiteSummary } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { siteFieldsForRole, buildSiteFormSchema } from '@/config/cms-site-fields'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import CmsFormDialog from '@/components/cms/CmsFormDialog.vue'

// Chaque page /admin/contenu/** déclare son propre meta (non hérité du parent contenu.vue).
definePageMeta({
  layout: false,
  middleware: 'admin',
  roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE],
})

const { user } = useUserSession()
const isSuperAdmin = computed(() => user.value?.role === ROLES.SUPER_ADMIN)

// --- Sélecteur de site : même motif que contenu/index.vue (Sections). ---
const { data: sites, status: sitesStatus } = await useFetch<AdminSiteSummary[]>('/api/admin/sites', {
  server: false,
  key: 'admin-sites',
  default: () => [] as AdminSiteSummary[],
})

const selectedSlug = ref<SiteSlug | undefined>(undefined)

watch(
  sites,
  (list) => {
    const stillValid = (list ?? []).some((s) => s.slug === selectedSlug.value)
    if (!stillValid) selectedSlug.value = list?.[0]?.slug
  },
  { immediate: true },
)

const selectedSummary = computed<AdminSiteSummary | null>(
  () => (sites.value ?? []).find((s) => s.slug === selectedSlug.value) ?? null,
)

// --- Détail de la fiche (GET/PATCH /api/admin/sites/[uuid]) ---
const site = ref<AdminSiteReglages | null>(null)
const siteStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const siteError = ref<AdminError | null>(null)
const editing = ref(false)
const submitting = ref(false)

async function loadSite(uuid: string): Promise<void> {
  siteStatus.value = 'pending'
  siteError.value = null
  try {
    site.value = await $fetch<AdminSiteReglages>(`/api/admin/sites/${encodeURIComponent(uuid)}`)
    siteStatus.value = 'success'
  } catch (e) {
    siteError.value = toAdminError(e)
    siteStatus.value = 'error'
  }
}

watch(
  selectedSummary,
  (summary) => {
    editing.value = false
    if (summary) {
      void loadSite(summary.uuid)
    } else {
      site.value = null
      siteStatus.value = 'idle'
    }
  },
  { immediate: true },
)

function retry(): void {
  if (selectedSummary.value) void loadSite(selectedSummary.value.uuid)
}

// --- Édition ---
const fields = computed(() => siteFieldsForRole(isSuperAdmin.value))
const schema = computed(() => buildSiteFormSchema(isSuperAdmin.value))

const initialValues = computed<Record<string, unknown>>(() => {
  const s = site.value
  if (!s) return {}
  const base: Record<string, unknown> = {
    nomCourt: s.nomCourt ?? '',
    secteur: s.secteur ?? '',
    description: s.description ?? '',
    heroImageKey: s.heroImageKey,
    effectif: s.effectif !== null ? String(s.effectif) : '',
    email: s.email ?? '',
    telephone: s.telephone ?? '',
    adresse: s.adresse ?? '',
    linkedinUrl: s.linkedinUrl ?? '',
    facebookUrl: s.facebookUrl ?? '',
    instagramUrl: s.instagramUrl ?? '',
  }
  if (isSuperAdmin.value) {
    base.nom = s.nom
    base.ordre = String(s.ordre)
  }
  return base
})

function openEdit(): void {
  editing.value = true
}

function onOpenChange(value: boolean): void {
  editing.value = value
}

async function handleSubmit(values: Record<string, unknown>): Promise<void> {
  const summary = selectedSummary.value
  if (!summary) return
  submitting.value = true
  try {
    site.value = await $fetch<AdminSiteReglages>(`/api/admin/sites/${encodeURIComponent(summary.uuid)}`, {
      method: 'PATCH',
      body: values,
    })
    toast.success('Fiche mise à jour.')
    editing.value = false
  } catch (e) {
    toast.error(toAdminError(e).message)
  } finally {
    submitting.value = false
  }
}

useHead({ title: 'Site — Contenu des sites' })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="max-w-xl text-sm text-muted-foreground">
        Coordonnées, présentation et image de couverture de la société — affichées sur le site public.
      </p>
      <Select
        v-if="(sites?.length ?? 0) > 1"
        :model-value="selectedSlug"
        @update:model-value="(v) => (selectedSlug = v as SiteSlug)"
      >
        <SelectTrigger class="w-56" aria-label="Site à gérer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in sites" :key="s.uuid" :value="s.slug">
            {{ s.nomCourt ?? s.nom }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="sitesStatus === 'pending' || siteStatus === 'pending'" class="space-y-2" role="status" aria-label="Chargement">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-40 w-full" />
    </div>

    <p v-else-if="!selectedSummary" class="text-sm text-muted-foreground">Aucun site accessible.</p>

    <div v-else-if="siteStatus === 'error'" class="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-6 text-sm">
      <p class="text-destructive">{{ siteError?.message ?? 'Une erreur est survenue.' }}</p>
      <Button variant="outline" size="sm" class="mt-3" @click="retry">Réessayer</Button>
    </div>

    <div v-else-if="site" class="overflow-hidden rounded-lg border border-border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p class="font-display text-lg font-semibold text-navy">{{ site.nomCourt ?? site.nom }}</p>
          <p class="text-xs text-muted-foreground">Fiche de la société</p>
        </div>
        <Button variant="outline" size="sm" class="gap-1.5" @click="openEdit">
          <Pencil class="size-3.5" aria-hidden="true" /> Modifier
        </Button>
      </div>

      <dl class="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-5 md:grid-cols-2">
        <div v-if="isSuperAdmin">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Nom légal</dt>
          <dd class="text-sm text-foreground">{{ site.nom }}</dd>
        </div>
        <div v-if="isSuperAdmin">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Ordre d'affichage</dt>
          <dd class="text-sm text-foreground">{{ site.ordre }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Secteur</dt>
          <dd class="text-sm text-foreground">{{ site.secteur ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Effectif</dt>
          <dd class="text-sm text-foreground">{{ site.effectif ?? '—' }}</dd>
        </div>
        <div class="md:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Description</dt>
          <dd class="text-sm text-foreground">{{ site.description ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Courriel</dt>
          <dd class="text-sm text-foreground">{{ site.email ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Téléphone</dt>
          <dd class="text-sm text-foreground">{{ site.telephone ?? '—' }}</dd>
        </div>
        <div class="md:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Adresse</dt>
          <dd class="text-sm text-foreground">{{ site.adresse ?? '—' }}</dd>
        </div>
        <div class="md:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Réseaux sociaux</dt>
          <dd class="text-sm text-foreground">
            <span v-if="!site.linkedinUrl && !site.facebookUrl && !site.instagramUrl">—</span>
            <span v-else class="flex flex-wrap gap-3">
              <a v-if="site.linkedinUrl" :href="site.linkedinUrl" target="_blank" rel="noopener" class="underline hover:text-navy">
                LinkedIn
              </a>
              <a v-if="site.facebookUrl" :href="site.facebookUrl" target="_blank" rel="noopener" class="underline hover:text-navy">
                Facebook
              </a>
              <a v-if="site.instagramUrl" :href="site.instagramUrl" target="_blank" rel="noopener" class="underline hover:text-navy">
                Instagram
              </a>
            </span>
          </dd>
        </div>
      </dl>

      <div v-if="site.heroImageKey" class="flex items-center gap-3 border-t border-border px-5 py-4">
        <img :src="`/api/files/${site.heroImageKey}`" alt="Aperçu de l’image de couverture" class="h-16 w-16 rounded-md border border-border object-cover">
        <p class="text-xs text-muted-foreground">Image de couverture, utilisée en repli pour le hero d'accueil.</p>
      </div>
    </div>

    <CmsFormDialog
      v-if="editing && site"
      :open="editing"
      titre="Modifier la fiche"
      :description="site.nomCourt ?? site.nom"
      :fields="fields"
      :schema="schema"
      :initial-values="initialValues"
      :site-uuid="site.uuid"
      :submitting="submitting"
      @update:open="onOpenChange"
      @submit="handleSubmit"
    />
  </div>
</template>
