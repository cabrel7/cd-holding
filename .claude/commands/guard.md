Transforme cet invariant en règle de garde-fou mécanique : $ARGUMENTS

(Si $ARGUMENTS est vide : reprends les invariants explicitement proposés juste avant dans la
conversation en disant lesquels tu traites, sinon demande lequel protéger.)

## Fonctionnement du hook (à connaître avant d'écrire la règle)
- Hook réel : `~/.claude/hooks/guard-pretool.sh` (PreToolUse Write|Edit).
- Il lit le **contenu** écrit (`tool_input.content` pour Write, `tool_input.new_string` pour Edit),
  PAS le fichier sur disque → sans `content` dans le JSON, il sort toujours 0 (test sans valeur).
- Il matche les GLOBS contre le **chemin complet** via `case` bash (`*` traverse les `/`) :
  `*/app/*.vue` exige un segment `/app/` dans le chemin.
- Règles lues dans `$CLAUDE_PROJECT_DIR/.claude/guard-rules.tsv`.

## Étapes
1. Traduis l'invariant en :
   - GLOBS inclus (virgules, ex: `*.php`, `*/Models/*.php`, `*/app/*.vue`)
   - GLOBS exclus (`-` si aucun ; exclure `*vendor*`, `*node_modules*`, code généré si pertinent)
   - REGEX `grep -E` qui détecte la VIOLATION (pas la conformité)
   - MESSAGE court : nom de l'invariant + correction à appliquer
2. **Faux positifs d'abord** : `grep -rnE '<REGEX>'` sur le code existant concerné
   (hors node_modules/vendor/généré). Chaque hit légitime → affiner la regex avant d'ajouter.
3. Ajoute la ligne dans `.claude/guard-rules.tsv` avec de VRAIES tabulations :
   vérifier que le fichier finit par un saut de ligne, puis
   `printf '%s\t%s\t%s\t%s\n' "$GLOBS" "$EXCL" "$REGEX" "$MSG" >> .claude/guard-rules.tsv`
   (définir les variables entre quotes simples si la regex contient `$` ou `\`).
4. TESTE via le vrai hook, contenu passé dans le JSON (jq gère l'échappement) :
   ```bash
   jq -n --arg f "/tmp/guardtest/proj/<chemin qui matche les globs>" --arg c '<contenu>' \
     '{tool_input:{file_path:$f,content:$c}}' \
     | CLAUDE_PROJECT_DIR="$PWD" bash ~/.claude/hooks/guard-pretool.sh; echo "exit $?"
   ```
   - contenu VIOLANT → exit 2
   - contenu CONFORME → exit 0
   - au moins un cas limite (nom proche, fichier hors périmètre des globs) → exit 0
   Le chemin factice reproduit la structure visée (ex. `/tmp/guardtest/proj/app/pages/x.vue`).
   Supprimer `/tmp/guardtest` à la fin.
5. Confirme : la ligne ajoutée (globs + regex + message), chaque test (exit obtenu vs attendu),
   les faux positifs trouvés/corrigés.
