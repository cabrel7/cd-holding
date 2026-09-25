Transforme cet invariant en règle mécanique : $ARGUMENTS
1. Traduis en : GLOBS inclus · GLOBS exclus (- si aucun ; exclure *vendor*/*node_modules*) ·
   REGEX grep -E détectant la VIOLATION · MESSAGE (nom invariant + correction).
2. Ajoute la ligne dans .claude/guard-rules.tsv avec de VRAIES tabulations
   (printf '%s\t%s\t%s\t%s\n').
3. TESTE : fichier violant + fichier conforme dans /tmp, passe chacun à
   .claude/../hooks guard (echo '{"tool_input":{"file_path":"...","content":"..."}}' | bash ~/.claude/hooks/guard-pretool.sh),
   vérifie exit 2 puis exit 0. Affine si faux positifs sur le code existant. Confirme le résultat.
