<script setup lang="ts">
// Message d'erreur d'un champ sur carte sombre : blanc, semi-gras et précédé d'une icône — il se
// distingue ainsi d'une simple aide sans reposer sur la couleur seule. Doit être rendu dans un
// <FormItem> (id lié à `aria-describedby` par <FormControl>). Sur fond clair, utiliser <FormMessage>.
import { CircleAlert } from '@lucide/vue'
import { useFormField } from '@/components/ui/form/useFormField'

const { error, formMessageId } = useFormField()
</script>

<template>
  <p v-if="error" :id="formMessageId" data-slot="form-message" class="flex items-start gap-1.5 text-sm font-semibold text-white">
    <CircleAlert :size="16" aria-hidden="true" class="mt-0.5 shrink-0" />
    <span>{{ error }}</span>
  </p>
</template>
