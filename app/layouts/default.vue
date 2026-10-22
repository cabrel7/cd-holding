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

// Logo du site courant (assets statiques par slug, lot logos) — servi en absolute sur
// l'hôte connu uniquement (og:image doit être absolue ; jamais d'URL dev).
const urlLogo = computed(() => (urlCanonical.value ? `${origine}/logos/${slug.value}.webp` : null))
const nomSeo = computed(() => site.value?.nomCourt ?? site.value?.nom ?? 'Groupe CD')

useHead(
  computed(() => {
    // GEO : Québec (siège du groupe) — repères utilisés par les moteurs/générateurs IA.
    const metas = [
      { name: 'geo.region', content: 'CA-QC' },
      { name: 'geo.placename', content: 'Québec, Canada' },
      { name: 'geo.position', content: '46.8139;-71.2080' },
      { name: 'ICBM', content: '46.8139, -71.2080' },
    ]
    // JSON-LD WebSite : identité du site pour la search (search enhancements).
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: nomSeo.value,
      inLanguage: 'fr-CA',
      ...(urlCanonical.value ? { url: urlCanonical.value } : {}),
      ...(site.value?.description ? { description: site.value.description } : {}),
      ...(site.value?.groupe?.nom ? { publisher: { '@type': 'Organization', name: site.value.groupe.nom } } : {}),
    }
    return {
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: `/favicons/${slug.value}-32.png` } as const,
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: `/favicons/${slug.value}-16.png` } as const,
        { rel: 'apple-touch-icon', sizes: '180x180', href: `/favicons/${slug.value}-180.png` } as const,
        { rel: 'icon', type: 'image/webp', sizes: '192x192', href: `/favicons/${slug.value}-192.webp` } as const,
        { rel: 'icon', type: 'image/webp', sizes: '512x512', href: `/favicons/${slug.value}-512.webp` } as const,
        ...(urlCanonical.value
          ? [{ rel: 'canonical' as const, href: urlCanonical.value }]
          : []),
      ],
      meta: metas,
      script: [{ type: 'application/ld+json', innerHTML: () => JSON.stringify(ld) }],
    }
  }),
)

useSeoMeta({
  ogUrl: () => urlCanonical.value ?? undefined,
  ogType: 'website',
  ogSiteName: () => nomSeo.value,
  ogLocale: 'fr_CA',
  ogImage: () => urlLogo.value ?? undefined,
  twitterCard: 'summary_large_image',
  twitterImage: () => urlLogo.value ?? undefined,
  description: () => site.value?.description ?? undefined,
})

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
