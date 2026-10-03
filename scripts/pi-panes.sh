#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == --list ]]; then
	exec tmux list-panes -a -f '#{@pi_pane_state}' -F $'#{session_id}:#{window_id}.#{pane_id}\t#{@pi_pane_state}\t#{session_name} / #{window_index}:#{window_name} / pane #{pane_index} (#{pane_id})'
fi

if [[ -z "${TMUX:-}" ]]; then
	printf 'Run pi-panes.sh inside tmux.\n' >&2
	exit 1
fi

if ! command -v fzf >/dev/null 2>&1; then
	printf 'pi-panes.sh requires fzf 0.73 or newer.\n' >&2
	exit 1
fi

version="$(fzf --version)"
IFS=. read -r major minor _ <<< "${version%% *}"
if (( major == 0 && minor < 73 )); then
	printf 'pi-panes.sh requires fzf 0.73 or newer.\n' >&2
	exit 1
fi

client="${1:-$(tmux display-message -p '#{client_name}')}"
script_path="$(cd -- "$(dirname -- "$0")" && pwd)/$(basename -- "$0")"
printf -v reload '%q --list' "$script_path"

if selection="$(FZF_DEFAULT_OPTS='' FZF_DEFAULT_OPTS_FILE='' fzf \
	--tmux=center,80%,70% --border=rounded --layout=reverse \
	--no-multi --delimiter=$'\t' --with-nth=2.. --track --id-nth=1 \
	--prompt='Pi panes> ' \
	--header=$'Live states, refreshed every second. Enter: jump. Esc: close.\n working    asking    waiting    unseen' \
	--with-shell='bash -c' --bind "start,every(1):reload-sync:$reload" < /dev/null)"; then
	[[ -n "$selection" ]] || exit 0
	tmux switch-client -c "$client" -t "${selection%%$'\t'*}"
else
	status=$?
	case "$status" in
		1|130) exit 0 ;;
		*) exit "$status" ;;
	esac
fi
