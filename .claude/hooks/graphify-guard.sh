#!/bin/zsh
# Wraps `graphify hook-guard` so its nudge reaches each session at most once per
# kind, and never fires on agent tooling (.claude/, .agents/) or Markdown docs.
# Usage: graphify-guard.sh search|read   (PreToolUse JSON on stdin)
kind=$1
input=$(cat)
graphify=$(command -v graphify || print -r -- ~/.local/bin/graphify)

if [[ $kind == read ]]; then
  target=$(jq -r '.tool_input.file_path // .tool_input.path // ""' <<<"$input")
  case $target in
    */.claude/* | .claude/* | */.agents/* | .agents/* | *.md | *.mdx) exit 0 ;;
  esac
fi

session=$(jq -r '.session_id // "unknown"' <<<"$input")
stamp="${TMPDIR:-/tmp}/graphify-guard/${session}-${kind}"
[[ -e $stamp ]] && exit 0

if [[ $kind == read ]]; then
  output=$("$graphify" hook-guard read --strict <<<"$input")
else
  output=$("$graphify" hook-guard search <<<"$input")
fi

# The strict deny is one-shot inside graphify; stamp only after a plain nudge.
if [[ -n $output && $output != *'"permissionDecision":"deny"'* ]]; then
  mkdir -p "${stamp:h}" && : >"$stamp"
fi
print -rn -- "$output"
