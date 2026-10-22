<script setup lang="ts">
// En-tête public partagé holding/filiale (spec §4.3). Remplace les deux composants distincts
// du prototype (Header.tsx / SubHeader.tsx) par un seul composant générique piloté par `variant`.
import { ArrowLeft, Menu, X } from '@lucide/vue'
import { useWindowScroll } from '@vueuse/core'
import { contactPath, HOLDING_SLUG, type NavItem } from '#shared/config/sites'
import type { PublicSite } from '#shared/types/public'

const props = defineProps<{
  site: PublicSite
  nav: readonly NavItem[]
  groupe: string
  variant: 'holding' | 'filiale'
  showNav: boolean
}>()

const HEADER_SCROLL_THRESHOLD_PX = 12
const MOBILE_NAV_ID = 'site-mobile-nav'

const route = useRoute()
const { y: scrollY } = useWindowScroll()
const scrolled = computed(() => scrollY.value > HEADER_SCROLL_THRESHOLD_PX)

const open = ref(false)

watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const displayName = computed(() => props.site.nomCourt ?? props.site.nom)

// Wordmark holding : dernier mot du nom du groupe en or (spec §4.3, table SiteHeader).
const groupeWords = computed(() => props.groupe.trim().split(/\s+/).filter(Boolean))
const groupeLead = computed(() => groupeWords.value.slice(0, -1).join(' '))
const groupeLast = computed(() => groupeWords.value.at(-1) ?? props.groupe)

// CTA contact : via siteHref (spec lot 8, D7) — nu en mode sous-domaine, préfixé en chemin.
const { href } = useSiteLinks()
const contactTo = computed(() => href(props.site.slug, contactPath(props.site.slug)).to)

// « Retour au {{ groupe }} » : en mode sous-domaine `/` est l'accueil de la FILIALE
// (dispatcher), plus celui du groupe — même traduction que le footer (href holding).
const lienGroupe = computed(() => href(HOLDING_SLUG, '/').to)

// En prod sous-domaine, le path SSR arrive préfixé (réécriture Nginx amont) alors que les
// href de nav sont nus : normaliser le path courant (strip du préfixe de site) avant
// comparaison — sinon aucun item actif au premier paint + mismatch d'hydratation (revue M1).
const cheminCourant = computed(() => {
  const { mode, slug } = useSiteHost().value
  const prefixe = `/${props.site.slug}`
  if (mode === 'sous-domaine' && slug === props.site.slug) {
    if (route.path === prefixe) return '/'
    if (route.path.startsWith(`${prefixe}/`)) return route.path.slice(prefixe.length)
  }
  return route.path
})

function isActive(item: NavItem): boolean {
  return !item.hash && cheminCourant.value === item.to
}
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
    :class="scrolled ? 'border-b border-border bg-cream/90 backdrop-blur' : 'bg-transparent'"
  >
    <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:py-5">
      <div class="flex items-center gap-4">
        <template v-if="variant === 'holding'">
          <NuxtLink to="/" class="inline-flex items-center gap-2.5">
            <img
              src="/favicons/holding-192.webp"
              alt=""
              aria-hidden="true"
              width="36"
              height="36"
              class="h-9 w-9 shrink-0"
            />
            <span class="flex items-baseline gap-1">
              <span class="font-display text-2xl font-bold tracking-tight text-navy">{{ groupeLead }}</span>
              <span class="font-display text-2xl font-bold tracking-tight text-gold-deep">{{ groupeLast }}</span>
            </span>
          </NuxtLink>
        </template>
        <template v-else>
          <NuxtLink
            :to="lienGroupe"
            class="hidden min-h-11 items-center gap-1 text-xs font-medium uppercase tracking-widest text-ink/75 transition-colors hover:text-navy lg:inline-flex"
          >
            <ArrowLeft :size="14" aria-hidden="true" /> {{ groupe }}
          </NuxtLink>
          <span class="hidden h-4 w-px bg-border lg:block" aria-hidden="true" />
          <span class="flex items-center gap-2.5">
            <img
              :src="`/favicons/${site.slug}-192.webp`"
              alt=""
              aria-hidden="true"
              width="32"
              height="32"
              class="h-8 w-8 shrink-0"
            />
            <span class="font-display text-lg font-bold leading-tight text-navy lg:text-xl">
              {{ displayName }}
            </span>
          </span>
        </template>
      </div>

      <nav v-if="showNav" aria-label="Navigation principale" class="hidden items-center gap-6 lg:flex xl:gap-8">
        <NuxtLink
          v-for="item in nav"
          :key="item.label"
          :to="item.hash ? { path: item.to, hash: item.hash } : item.to"
          class="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-medium transition-colors hover:text-navy"
          :class="isActive(item) ? 'text-navy' : 'text-ink/75'"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
        <NuxtLink
          :to="contactTo"
          class="inline-flex items-center rounded-full bg-site-accent-strong whitespace-nowrap px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          Nous joindre
        </NuxtLink>
      </nav>

      <button
        v-if="showNav"
        type="button"
        class="-m-2.5 rounded-sm p-2.5 text-navy outline-none lg:hidden focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        aria-label="Menu"
        :aria-expanded="open"
        :aria-controls="MOBILE_NAV_ID"
        @click="open = !open"
      >
        <X v-if="open" :size="24" aria-hidden="true" />
        <Menu v-else :size="24" aria-hidden="true" />
      </button>
    </div>

    <Transition name="site-mobile-nav">
      <div
        v-if="showNav && open"
        :id="MOBILE_NAV_ID"
        class="overflow-hidden border-t border-border bg-cream lg:hidden"
      >
        <div class="flex flex-col gap-1 px-6 py-4">
          <NuxtLink
            v-if="variant === 'filiale'"
            :to="lienGroupe"
            class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink/70"
          >
            <ArrowLeft :size="14" aria-hidden="true" /> Retour au {{ groupe }}
          </NuxtLink>
          <NuxtLink
            v-for="item in nav"
            :key="item.label"
            :to="item.hash ? { path: item.to, hash: item.hash } : item.to"
            class="inline-flex min-h-11 items-center text-base font-medium text-navy"
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            {{ item.label }}
          </NuxtLink>
          <NuxtLink
            :to="contactTo"
            class="mt-2 inline-flex items-center justify-center rounded-full bg-site-accent-strong px-5 py-3 text-sm font-semibold text-white"
          >
            Nous joindre
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.site-mobile-nav-enter-active,
.site-mobile-nav-leave-active {
  transition:
    grid-template-rows 0.2s ease,
    opacity 0.2s ease;
}
.site-mobile-nav-enter-from,
.site-mobile-nav-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .site-mobile-nav-enter-active,
  .site-mobile-nav-leave-active {
    transition: none;
  }
}
</style>
