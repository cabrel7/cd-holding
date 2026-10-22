<script setup lang="ts">
// Layout public unique (holding + filiales) — spec §4.3 (DEC-09). Charge le site courant,
// injecte son accent, gère la page de maintenance (503, noindex, header sans navigation).
// Nav et SEO hébergent la traduction des liens du lot 8 : `publicNav` reste la source unique
// en chemins préfixés, la traduction nu/absolu se fait au rendu via `useSiteLinks` (D7/D9).
import { HOLDING_SLUG, publicNav } from '#shared/config/sites'
import { cheminRelatif } from '#shared/utils/site-links'
import type { SectionData } from '@/composables/useSiteSections'
import SiteHeader from '@/components/site/SiteHeader.vue'
import SiteFooter from '@/components/site/SiteFooter.vue'
import SiteMaintenance from '@/components/site/SiteMaintenance.vue'

const slug = useCurrentSiteSlug()
const { data: site, error } = await useSite(slug)
const { data: filialesSummary } = useSites()

const route = useRoute()
const links = useSiteLinks()
const origine = useRequestURL().origin

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Introuvable', fatal: true })
}

// `publicNav` émet des chemins préfixés (`/<slug>/services`) ; `siteHref` attend un chemin
// relatif au site — traduction via le helper pur (le holding n'a pas de préfixe dans ses
// items, le test est donc sans effet pour lui).
const variant = computed<'holding' | 'filiale'>(() => (slug.value === HOLDING_SLUG ? 'holding' : 'filiale'))
const nav = computed(() =>
  publicNav(slug.value).map((item) => ({
    label: item.label,
    // Items toujours de même site que l'hôte (nav interne) → lien relatif, jamais externe.
    to: links.href(slug.value, cheminRelatif(slug.value, item.to), item.hash).to,
  })),
)
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

// SEO (D9) : canonical + og:url émis UNIQUEMENT si l'hôte est connu (prod) — jamais en dev.
// Le path courant est passé tel quel : canonicalPath strip le préfixe de site en mode
// sous-domaine (le path serveur est préfixé par la réécriture amont).
const urlCanonical = computed(() => {
  const chemin = links.canonical(route.path)
  return chemin === null ? null : `${origine}${chemin}`
})

useHead(
  computed(() =>
    urlCanonical.value ? { link: [{ rel: 'canonical', href: urlCanonical.value }] } : {},
  ),
)
useSeoMeta({ ogUrl: () => urlCanonical.value ?? undefined })

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
