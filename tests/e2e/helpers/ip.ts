// IP TEST-NET-3 (RFC 5737, 203.0.113.x) distincte par test : le rate-limit serveur (en mémoire,
// candidature 3/h/IP, réservation 5/10 min/IP, contact 5/10 min/IP) est keyé sur `x-forwarded-for`
// (lu car la connexion vient du loopback). Partagé par les specs du lot 3.
const IP_SUFFIX_MAX = 253
const used = new Set<number>()

export function nextTestIp(): string {
  if (used.size >= IP_SUFFIX_MAX) used.clear()
  let suffix: number
  do {
    suffix = 1 + Math.floor(Math.random() * IP_SUFFIX_MAX)
  } while (used.has(suffix))
  used.add(suffix)
  return `203.0.113.${suffix}`
}
