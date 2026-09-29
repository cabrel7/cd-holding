<script setup lang="ts">
import { computed, ref } from 'vue'
import { LogOut } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { ROLE_LABELS } from '#shared/config/admin'
import { ROLES } from '#shared/utils/roles'
import { ADMIN_NAV, isNavItemActive, navLabel } from '@/config/admin-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const authStore = useAuthStore()
const { sites } = useAdminShell()

const user = computed(() => authStore.user)
const roleLabel = computed(() => (user.value ? ROLE_LABELS[user.value.role] : ''))

const route = useRoute()

// Titre contextuel (le nom du groupe est déjà dans la barre latérale) : ADMIN_FILIALE → sa
// filiale (seul site renvoyé par l'API) ; sinon la section courante.
const contexteNom = computed(() => {
  const role = user.value?.role
  if (role === ROLES.ADMIN_FILIALE && sites.value[0]) return sites.value[0].nom
  const item = ADMIN_NAV.find((entry) => isNavItemActive(entry, route.path))
  return item && role ? navLabel(item, role) : 'Console d\'administration'
})

const deconnexionEnCours = ref(false)

async function deconnecter(): Promise<void> {
  if (deconnexionEnCours.value) return
  deconnexionEnCours.value = true
  try {
    if (await authStore.logout()) {
      toast.success('Vous avez été déconnecté.')
    }
  } finally {
    deconnexionEnCours.value = false
  }
}
</script>

<template>
  <header class="border-border bg-card flex h-16 shrink-0 items-center justify-between gap-3 border-b px-3 md:px-8">
    <div class="flex min-w-0 items-center gap-2">
      <SidebarTrigger />
      <span class="font-display text-navy truncate text-sm font-semibold">{{ contexteNom }}</span>
    </div>

    <div class="flex items-center gap-3 md:gap-4">
      <div v-if="user" class="hidden flex-col items-end gap-1 md:flex">
        <span class="text-navy text-sm font-medium">{{ user.nom }}</span>
        <Badge variant="secondary">{{ roleLabel }}</Badge>
      </div>

      <AlertDialog>
        <AlertDialogTrigger as-child>
          <Button variant="outline" class="min-h-11 gap-2 md:min-h-9" :disabled="deconnexionEnCours">
            <LogOut aria-hidden="true" />
            <span class="hidden sm:inline">Déconnexion</span>
            <span class="sr-only sm:hidden">Se déconnecter</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
            <AlertDialogDescription>Vous serez redirigé vers l'écran de connexion.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction @click="deconnecter">Se déconnecter</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </header>
</template>
