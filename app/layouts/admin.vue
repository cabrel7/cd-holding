<script setup lang="ts">
// Shell de la console /admin/** (thème clair, tokens des sites publics). Les pages déclarent
// `definePageMeta({ layout: 'admin', middleware: 'admin' })`. La transition de page est
// volontairement « entrée seule » : garder l'ancien contenu pendant une sortie ferait ré-afficher
// la nouvelle page dans l'ancien nœud (le slot lit la route courante).
import AdminHeader from '@/components/admin/AdminHeader.vue'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'
import { ADMIN_GROUP_NAME } from '@/config/admin-nav'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

const route = useRoute()
// Les onglets de /admin/contenu/* ne rejouent pas la transition de tout le shell.
const pageKey = computed(() => route.matched[0]?.path ?? route.path)
</script>

<template>
  <SidebarProvider class="bg-background">
    <a
      href="#contenu-principal"
      class="bg-primary text-primary-foreground focus-visible:ring-ring sr-only z-[60] rounded-md px-4 py-3 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2"
    >
      Aller au contenu
    </a>
    <AdminSidebar />
    <SidebarInset>
      <AdminHeader />
      <main id="contenu-principal" tabindex="-1" class="flex-1 px-4 py-8 outline-none md:px-10 md:py-10">
        <Transition name="admin-page">
          <div :key="pageKey">
            <slot />
          </div>
        </Transition>
      </main>
      <footer class="border-border bg-card text-muted-foreground border-t px-4 py-4 text-xs md:px-10">
        <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <span>{{ ADMIN_GROUP_NAME }} — Console d'administration</span>
          <NuxtLink to="/" class="hover:text-navy inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            Voir le site public
          </NuxtLink>
        </div>
      </footer>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>
.admin-page-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
}
.admin-page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .admin-page-enter-active {
    transition: none;
  }
}
</style>
