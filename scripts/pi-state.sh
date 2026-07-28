#!/usr/bin/env bash

pane_id="${1:-}"
[[ -n "$pane_id" ]] || exit 0

pane_title="$(tmux display-message -p -t "$pane_id" '#{pane_title}' 2>/dev/null || true)"

case "$pane_title" in
	""|π:[[:space:]]*undefined*|pi:[[:space:]]*undefined*) ;;
	π:*|pi:*) printf '%s' "$pane_title" ;;
esac
