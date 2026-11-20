#!/usr/bin/env bash
# Avvio sessione Claude Code.
# - Sul PC non fa nulla: Ponytail arriva dal plugin e graphify dall'installazione locale.
# - Nelle sessioni cloud (CLAUDE_CODE_REMOTE=true) installa graphify, costruisce il grafo
#   del codice (solo AST, niente LLM, niente dati inviati fuori) e carica le regole Ponytail.
# Non blocca mai la sessione: ogni errore viene ignorato.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
export PATH="$HOME/.local/bin:$PATH" GRAPHIFY_BACKEND=none GRAPHIFY_QUERY_LOG_DISABLE=1

if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv tool install -q 'graphifyy[sql]' >/dev/null 2>&1
  else
    python3 -m pip install -q --user 'graphifyy[sql]' >/dev/null 2>&1
  fi
fi
if command -v graphify >/dev/null 2>&1; then
  graphify extract . --code-only >/dev/null 2>&1 && graphify cluster-only . --no-label >/dev/null 2>&1
fi

# Il testo stampato qui entra nel contesto della sessione.
# Se il plugin Ponytail è già installato, le sue regole arrivano da lì: niente doppione.
if [ -z "$(find "$HOME/.claude/plugins" -maxdepth 5 -type d -name 'ponytail*' 2>/dev/null | head -1)" ]; then
  cat .claude/ponytail-rules.md 2>/dev/null
fi
exit 0
