Délègue au subagent reviewer : audit du code EXISTANT contre les invariants
(section INVARIANTS du CLAUDE.md + règles de .claude/guard-rules.tsv).
1. Pour chaque règle du TSV : grep -rnE sur les sources (hors node_modules/vendor/dist).
2. Pour chaque invariant du CLAUDE.md sans règle mécanique : vérifie manuellement + PROPOSE
   la règle grep à ajouter au TSV.
3. Invariants transversaux (médias, IA, plans…) : vérifie TOUTES les entités concernées.
Corrige CRITICAL/MAJOR directement, liste MINOR. Termine par le décompte + maj PROJECT_STATE.md.
