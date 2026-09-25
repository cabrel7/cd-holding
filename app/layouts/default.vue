<script setup lang="ts">
// Layout public unique (holding + filiales) — spec §4.3 (DEC-09). Charge le site courant,
// injecte son accent, gère la page de maintenance (503, noindex, header sans navigation).
import { HOLDING_SLUG, publicNav } from '#shared/config/sites'
import type { SectionData } from '@/composables/useSiteSections'
import SiteHeader from '@/components/site/SiteHeader.vue'
import SiteFooter from '@/components/site/SiteFooter.vue'
import SiteMaintenance from '@/components/site/SiteMaintenance.vue'

const slug = useCurrentSiteSlug()
const { data: site, error } = await useSite(slug)
const { data: filialesSummary } = useSites()

const route = useRoute()

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Introuvable', fatal: true })
}

const variant = computed<'holding' | 'filiale'>(() => (slug.value === HOLDING_SLUG ? 'holding' : 'filiale'))
const nav = computed(() => publicNav(slug.value))
const groupe = computed(() => site.value?.groupe.nom ?? 'Groupe CD')
const filiales = computed(() => (variant.value === 'holding' ? filialesSummary.value ?? [] : undefined))

const bypassMaintenance = computed(() => route.meta.bypassMaintenance === true)
const isMaintenance = computed(
  () => !!site.value && site.value.statutSite !== 'ACTIF' && !bypassMaintenance.value,
)
const maintenanceSection = computed<SectionData | null>(() => {
  const donnees = site.value?.commun.maintenance
  return donnees && typeof donnees.titre === 'string' ? (donnees as unknown as SectionData) : null
})

const accentStyle = computed(() => ({ '--site-accent': site.value?.couleurAccent ?? undefined }))

if (import.meta.server && isMaintenance.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 503)
  useResponseHeader('Retry-After').value = '3600'
}

if (isMaintenance.value) {
  useSeoMeta({ robots: 'noindex' })
}
</script>

<template>
  <div v-if="site" :style="accentStyle" :data-site="slug" class="min-h-screen bg-cream text-ink">
    <SiteHeader
      :site="site"
      :nav="nav"
      :groupe="groupe"
      :variant="variant"
      :show-nav="!isMaintenance"
    />
    <main>
      <SiteMaintenance v-if="isMaintenance" :site="site" :section="maintenanceSection" />
      <slot v-else />
    </main>
    <SiteFooter :site="site" :groupe="groupe" :filiales="filiales" />
  </div>
</template>
