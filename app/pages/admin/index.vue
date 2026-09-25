<script setup lang="ts">
import { LogOut } from '@lucide/vue'
import { Button } from '@/components/ui/button'

definePageMeta({ middleware: 'admin', layout: false })

const authStore = useAuthStore()

useHead({ title: 'Tableau de bord — Administration' })
</script>

<template>
  <!-- Shell minimal du scaffold : le vrai dashboard sera converti depuis le prototype (route /admin). -->
  <main class="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Tableau de bord</h1>
        <p class="text-sm text-muted-foreground">
          {{ authStore.user?.nom }} — {{ authStore.user?.role }}
        </p>
      </div>
      <Button variant="outline" @click="authStore.logout()">
        <LogOut aria-hidden="true" />
        Déconnexion
      </Button>
    </header>
  </main>
</template>
