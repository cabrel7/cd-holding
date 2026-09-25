<script setup lang="ts">
// En-tête public partagé holding/filiale (spec §4.3). Remplace les deux composants distincts
// du prototype (Header.tsx / SubHeader.tsx) par un seul composant générique piloté par `variant`.
import { ArrowLeft, Menu, X } from '@lucide/vue'
import { useWindowScroll } from '@vueuse/core'
import type { NavItem } from '#shared/config/sites'
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

const contactTo = computed(
  () => props.nav.find((item) => item.label === 'Contact')?.to ?? '/contact',
)

function isActive(item: NavItem): boolean {
  return !item.hash && route.path === item.to
}
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
    :class="scrolled ? 'border-b border-border bg-cream/90 backdrop-blur' : 'bg-transparent'"
  >
    <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:py-5">
      <div class="flex items-center gap-4">
        <template v-if="variant === 'holding'">
          <NuxtLink to="/" class="inline-flex items-baseline gap-1">
            <span class="font-display text-2xl font-bold tracking-tight text-navy">{{ groupeLead }}</span>
            <span class="font-display text-2xl font-bold tracking-tight text-gold">{{ groupeLast }}</span>
          </NuxtLink>
        </template>
        <template v-else>
          <NuxtLink
            to="/"
            class="hidden items-center gap-1 text-xs font-medium uppercase tracking-widest text-ink/60 transition-colors hover:text-navy md:inline-flex"
          >
            <ArrowLeft :size="14" aria-hidden="true" /> {{ groupe }}
          </NuxtLink>
          <span class="hidden h-4 w-px bg-border md:block" aria-hidden="true" />
          <span class="font-display text-lg font-bold leading-tight text-navy md:text-xl">
            {{ displayName }}
          </span>
        </template>
      </div>

      <nav v-if="showNav" aria-label="Navigation principale" class="hidden items-center gap-8 md:flex">
        <NuxtLink
          v-for="item in nav"
          :key="item.label"
          :to="item.hash ? { path: item.to, hash: `#${item.hash}` } : item.to"
          class="text-sm font-medium transition-colors hover:text-navy"
          :class="isActive(item) ? 'text-navy' : 'text-ink/75'"
        >
          {{ item.label }}
        </NuxtLink>
        <NuxtLink
          :to="contactTo"
          class="inline-flex items-center rounded-full bg-site-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          Nous joindre
        </NuxtLink>
      </nav>

      <button
        v-if="showNav"
        type="button"
        class="text-navy md:hidden"
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
        class="overflow-hidden border-t border-border bg-cream md:hidden"
      >
        <div class="flex flex-col gap-1 px-6 py-4">
          <NuxtLink
            v-if="variant === 'filiale'"
            to="/"
            class="inline-flex items-center gap-2 py-2 text-sm font-medium text-ink/70"
          >
            <ArrowLeft :size="14" aria-hidden="true" /> Retour au {{ groupe }}
          </NuxtLink>
          <NuxtLink
            v-for="item in nav"
            :key="item.label"
            :to="item.hash ? { path: item.to, hash: `#${item.hash}` } : item.to"
            class="py-2 text-base font-medium text-navy"
          >
            {{ item.label }}
          </NuxtLink>
          <NuxtLink
            :to="contactTo"
            class="mt-2 inline-flex items-center justify-center rounded-full bg-site-accent px-5 py-2.5 text-sm font-semibold text-white"
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
