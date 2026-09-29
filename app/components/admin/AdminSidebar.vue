<script setup lang="ts">
import { computed, watch } from 'vue'
import { isNavItemActive, navLabel, visibleNavItems, ADMIN_GROUP_NAME } from '@/config/admin-nav'
import type { ModuleKey } from '#shared/config/modules'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const COMPTEUR_MAX_AFFICHE = 99

const route = useRoute()
const { user } = useUserSession()
const { sites, compteurs } = useAdminShell()
const { isMobile, setOpenMobile } = useSidebar()

const modules = computed<ReadonlySet<ModuleKey>>(() => new Set(sites.value.flatMap((site) => site.modules)))

const items = computed(() => {
  const role = user.value?.role
  if (!role) return []
  return visibleNavItems(role, modules.value).map((item) => ({
    item,
    label: navLabel(item, role),
    active: isNavItemActive(item, route.path),
    nouveaux: item.compteur === 'messagesNouveaux' ? (compteurs.value?.nouveaux ?? 0) : 0,
  }))
})

function badgeText(n: number): string {
  return n > COMPTEUR_MAX_AFFICHE ? `${COMPTEUR_MAX_AFFICHE}+` : String(n)
}

function badgeLabel(n: number): string {
  return `${n} ${n > 1 ? 'messages non lus' : 'message non lu'}`
}

// Le Sheet mobile se ferme dès qu'une navigation aboutit.
watch(
  () => route.path,
  () => {
    if (isMobile.value) setOpenMobile(false)
  },
)
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader class="border-border h-16 justify-center border-b px-4">
      <NuxtLink
        to="/admin"
        class="focus-visible:ring-ring flex min-h-11 items-center gap-3 rounded-md outline-hidden focus-visible:ring-2"
      >
        <span
          class="bg-navy text-gold flex size-9 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold"
          aria-hidden="true"
        >
          CD
        </span>
        <span class="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]/sidebar:sr-only">
          <span class="font-display text-navy truncate text-sm font-semibold">{{ ADMIN_GROUP_NAME }}</span>
          <span class="text-muted-foreground text-xs">Console d'administration</span>
        </span>
      </NuxtLink>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <nav aria-label="Navigation de la console">
            <SidebarMenu>
              <SidebarMenuItem v-for="entry in items" :key="entry.item.to">
                <SidebarMenuButton
                  as-child
                  :is-active="entry.active"
                  :tooltip="entry.label"
                >
                  <NuxtLink :to="entry.item.to" :aria-current="entry.active ? 'page' : undefined">
                    <component :is="entry.item.icon" aria-hidden="true" />
                    <span>{{ entry.label }}</span>
                  </NuxtLink>
                </SidebarMenuButton>
                <SidebarMenuBadge
                  v-if="entry.nouveaux > 0"
                  role="img"
                  :aria-label="badgeLabel(entry.nouveaux)"
                >
                  {{ badgeText(entry.nouveaux) }}
                </SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </nav>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template>
