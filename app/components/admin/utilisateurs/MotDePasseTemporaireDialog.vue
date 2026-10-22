<script setup lang="ts">
// Dialog « Mot de passe temporaire » (spec lot 6 §5, D14) : commun à la création et à la
// réinitialisation, ouvert SEULEMENT après le 201/200 — la valeur n'est jamais relisible côté
// serveur. Champ en lecture seule avec bascule Eye/EyeOff ; copie via `navigator.clipboard`
// (indisponible hors contexte sécurisé ⇒ repli « sélection manuelle » sur le champ, aucune
// promesse de copie non tenue).
import { ref, watch } from 'vue'
import { ClipboardCopy, Eye, EyeOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  open: boolean
  /** Mot de passe temporaire renvoyé une seule fois par le serveur (201 création / 200 reset). */
  motDePasse: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const affiche = ref(false)
const copieReussie = ref(false)
const repliSelection = ref(false)

// `<Input>` n'expose pas l'élément natif : on le retrouve dans le conteneur (miroir MotDePasseDialog).
const zoneChamp = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) return
    affiche.value = false
    copieReussie.value = false
    repliSelection.value = false
  },
)

async function copier(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.motDePasse)
    copieReussie.value = true
    repliSelection.value = false
  } catch {
    // Presse-papiers indisponible : le champ est sélectionné, la copie se fait à la main.
    copieReussie.value = false
    repliSelection.value = true
    zoneChamp.value?.querySelector<HTMLInputElement>('input')?.select()
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Mot de passe temporaire</DialogTitle>
        <DialogDescription>
          Ce mot de passe ne sera plus affiché. Communiquez-le à l'utilisateur en dehors de la plateforme.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-2">
        <Label for="compte-mdp-temporaire">Mot de passe</Label>
        <div ref="zoneChamp" class="relative">
          <Input
            id="compte-mdp-temporaire"
            :model-value="motDePasse"
            :type="affiche ? 'text' : 'password'"
            readonly
            autocomplete="off"
            class="h-11 pr-12 md:h-10"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            :aria-label="affiche ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
            @click="affiche = !affiche"
          >
            <EyeOff v-if="affiche" class="size-4" aria-hidden="true" />
            <Eye v-else class="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Button type="button" variant="outline" class="min-h-11 w-full md:w-auto" @click="copier">
        <ClipboardCopy aria-hidden="true" />
        Copier le mot de passe
      </Button>

      <p v-if="copieReussie" role="status" aria-live="polite" class="text-sm text-muted-foreground">
        Mot de passe copié.
      </p>
      <p v-else-if="repliSelection" role="status" class="text-sm text-muted-foreground">
        Le presse-papiers n'est pas disponible ici : le mot de passe est sélectionné, copiez-le avec Ctrl+C (ou
        Cmd+C).
      </p>

      <DialogFooter>
        <Button type="button" class="min-h-11 md:min-h-9" @click="emit('update:open', false)">Fermer</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
