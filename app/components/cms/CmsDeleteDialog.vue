<script setup lang="ts">
// AlertDialog de suppression CMS — remplace toute boîte de dialogue native du navigateur
// (interdite dans le dashboard, voir CLAUDE.md).
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

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
    <AlertDialogContent
      @escape-key-down="(e) => { if (submitting) e.preventDefault() }"
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{{ titre }}</AlertDialogTitle>
        <AlertDialogDescription>{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="submitting">Annuler</AlertDialogCancel>
        <!--
          Bouton natif (pas AlertDialogAction) : AlertDialogAction est un DialogClose
          reka-ui qui ferme TOUJOURS le dialog au clic (comportement interne non
          annulable), avant même que le handler @click du consommateur ne s'exécute.
          Le dialog reste donc entièrement piloté par le parent (`open`) et ne se
          ferme qu'après résolution de la suppression (succès), jamais au clic.
        -->
        <Button
          type="button"
          variant="destructive"
          :disabled="submitting"
          @click="emit('confirm')"
        >
          {{ submitting ? 'Suppression…' : 'Supprimer' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
