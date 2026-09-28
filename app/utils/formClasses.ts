// Classes partagées des formulaires publics (clair sur fond crème/blanc, sombre sur carte navy
// ou site-accent-strong). Le contraste et le focus sont corrigés ici une seule fois : les
// cartes sombres (assistant, réservation) posent `--carte-fond` (couleur de la carte) pour que
// l'anneau de focus blanc garde un espacement de la même couleur que le fond.

export type ToneFormulaire = 'clair' | 'sombre'

/** Anneau de focus blanc + espacement de la couleur de la carte (boutons/liens sur fond sombre). */
export const FOCUS_CARTE_SOMBRE =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--carte-fond)]'

export const LABEL_CLAIR = 'font-display text-xs font-semibold uppercase tracking-widest text-navy'
export const LABEL_SOMBRE =
  'font-display text-xs font-semibold uppercase tracking-widest text-white/80 data-[error=true]:text-white'

export const CONTROLE_CLAIR = 'h-12 rounded-xl bg-white px-4'
export const CONTROLE_SOMBRE = `h-12 rounded-xl bg-white px-4 text-ink ${FOCUS_CARTE_SOMBRE} focus-visible:border-transparent aria-invalid:outline-solid aria-invalid:outline-2 aria-invalid:outline-white`

export const TEXTAREA_CLAIR = 'resize-none rounded-xl bg-white px-4 py-3'
export const TEXTAREA_SOMBRE = `resize-none rounded-xl bg-white px-4 py-3 text-ink ${FOCUS_CARTE_SOMBRE} focus-visible:border-transparent aria-invalid:outline-solid aria-invalid:outline-2 aria-invalid:outline-white`

const SELECT_BASE =
  'h-12 w-full appearance-none rounded-xl border bg-white px-4 pr-10 text-base text-ink disabled:opacity-60 md:text-sm'

/** Select natif (une seule définition : border, aria-invalid, focus). */
export const SELECT_CLASS = `${SELECT_BASE} border-input outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20`
export const SELECT_CLASS_SOMBRE = `${SELECT_BASE} border-transparent ${FOCUS_CARTE_SOMBRE} aria-invalid:outline aria-invalid:outline-solid aria-invalid:outline-2 aria-invalid:outline-white`

/** Case à cocher de consentement (accent = token du site, jamais de couleur codée en dur). */
export const CHECKBOX_CLASS =
  'mt-0.5 size-5 shrink-0 rounded border-2 border-ink/60 accent-site-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-accent-strong'
