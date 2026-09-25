// Échappement HTML pur pour les gabarits de courriel (server/lib/mail/templates/*.ts) —
// jamais de contenu utilisateur interpolé dans un gabarit HTML sans passer par ici.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}
