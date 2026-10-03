#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
work="$(mktemp -d)"
socket="$work/tmux.sock"
trap 'tmux -S "$socket" kill-server 2>/dev/null || true; rm -rf "$work"' EXIT

pane="$(tmux -S "$socket" -f /dev/null new-session -d -s 'pi popup check' -n 'pi window' -P -F '#{pane_id}' 'sleep 60')"
export TMUX="$socket,0,0"

[[ -z "$("$root/scripts/pi-panes.sh" --list)" ]]
tmux split-window -d -t "$pane" 'sleep 60'
target="$(tmux display-message -p -t "$pane" '#{session_id}:#{window_id}.#{pane_id}')"

for icon in '' '' '' ''; do
	tmux set-option -pq -t "$pane" @pi_pane_state "$icon"
	row="$("$root/scripts/pi-panes.sh" --list)"
	expected="$target"$'\t'"$icon"$'\t'"pi popup check / 0:pi window / pane 0 ($pane)"
	[[ "$row" == "$expected" ]]
	selected="$(printf '%s\n' "$row" | FZF_DEFAULT_OPTS='' FZF_DEFAULT_OPTS_FILE='' fzf --delimiter=$'\t' --with-nth=2.. --filter='pi popup check')"
	[[ "${selected%%$'\t'*}" == "$target" ]]
done

tmux new-session -d -s linked 'sleep 60'
tmux link-window -s "$target" -t linked
rows="$("$root/scripts/pi-panes.sh" --list)"
[[ "$(printf '%s\n' "$rows" | wc -l | tr -d ' ')" == 2 ]]
[[ "$(printf '%s\n' "$rows" | cut -f1 | sort -u | wc -l | tr -d ' ')" == 2 ]]

tmux set-option -pqu -t "$pane" @pi_pane_state
[[ -z "$("$root/scripts/pi-panes.sh" --list)" ]]
printf 'Pi pane listing, state changes, filtering, and linked-window targets passed.\n'
