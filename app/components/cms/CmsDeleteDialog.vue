<script setup lang="ts">
// AlertDialog de suppression CMS — remplace toute boîte de dialogue native du navigateur
// (interdite dans le dashboard, voir CLAUDE.md).
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

withDefaults(
  defineProps<{
    open: boolean
    titre?: string
    description?: string
    submitting?: boolean
  }>(),
  {
    titre: 'Supprimer cette fiche ?',
    description: 'La fiche disparaîtra du site public et de la console.',
    submitting: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <AlertDialog :open="open" @update:open="(v) => emit('update:open', v)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ titre }}</AlertDialogTitle>
        <AlertDialogDescription>{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="submitting">Annuler</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-white hover:bg-destructive/90"
          :disabled="submitting"
          @click="emit('confirm')"
        >
          {{ submitting ? 'Suppression…' : 'Supprimer' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
