#!/usr/bin/env bash
# Publica a main les dades generades per un workflow sense perdre la feina si main ha canviat mentrestant.
#
# Ús:  bash scripts/publicar_dades.sh "missatge del commit" data js/channels-ca.json …
#
# Abans, `git push origin HEAD:main` fallava («rejected: fetch first») si un altre commit havia arribat a main durant
# la generació, i es perdia el feed que acabava de gastar la quota de YouTube. Ara, si el push falla, fa
# `git pull --rebase` (en un conflicte d'un fitxer generat es queda la versió que s'acaba de generar) i ho torna a
# provar, fins a 4 vegades.
set -euo pipefail

message="${1:?Falta el missatge del commit}"
shift
if [ "$#" -eq 0 ]; then
  echo "Falten els camins a publicar" >&2
  exit 2
fi

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add -A -- "$@"

if git diff --cached --quiet; then
  echo "Sense canvis per publicar."
  exit 0
fi

git commit -m "$message"

attempts=4
for attempt in $(seq 1 "$attempts"); do
  if git push origin HEAD:main; then
    echo "✅ Publicat a main (intent $attempt/$attempts)."
    exit 0
  fi
  if [ "$attempt" -eq "$attempts" ]; then
    break
  fi
  echo "main ha canviat mentre es generaven les dades: git pull --rebase i es torna a provar ($attempt/$attempts)."
  sleep $((attempt * 5))
  # Durant el rebase, «theirs» és el commit que s'hi torna a aplicar (el nostre): en un conflicte d'un fitxer
  # generat mana el que s'acaba de generar, no la versió vella de main.
  if ! git pull --rebase -X theirs origin main; then
    git rebase --abort || true
    echo "::error::No s'ha pogut fer el rebase sobre main (conflicte que no es resol sol). Les dades no s'han publicat."
    exit 1
  fi
done

echo "::error::No s'ha pogut publicar a main després de $attempts intents."
exit 1
