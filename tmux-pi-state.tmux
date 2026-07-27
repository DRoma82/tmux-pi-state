#!/usr/bin/env bash

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_STATE_PLACEHOLDER='\#{pi-state}'
PI_STATE_COMMAND="#($CURRENT_DIR/scripts/pi-state.sh \"#{pane_id}\")"

get_tmux_option() {
	local option="$1"
	local default_value="$2"
	local value

	value="$(tmux show-option -gqv "$option")"
	if [[ -n "$value" ]]; then
		printf '%s' "$value"
	else
		printf '%s' "$default_value"
	fi
}

set_tmux_option() {
	local option="$1"
	local value="$2"
	tmux set-option -gq "$option" "$value"
}

interpolate_pi_state() {
	local value="$1"
	printf '%s' "${value//$PI_STATE_PLACEHOLDER/$PI_STATE_COMMAND}"
}

update_tmux_option() {
	local option="$1"
	local option_value
	local new_option_value

	option_value="$(get_tmux_option "$option" "")"
	new_option_value="$(interpolate_pi_state "$option_value")"
	set_tmux_option "$option" "$new_option_value"
}

main() {
	local interpolated_options
	local interpolated_option

	interpolated_options="$(get_tmux_option "@pi_state_interpolated_options" "window-status-format window-status-current-format")"
	for interpolated_option in $interpolated_options; do
		update_tmux_option "$interpolated_option"
	done
}

main
