# tmux-pi-state

TPM-compatible tmux plugin and Pi package for showing Pi coding-agent state in tmux.

The Pi extension updates the current tmux pane title to values like:

```text
π:Working
π:Waiting
```

The tmux plugin adds a `#{pi-state}` placeholder that expands to that pane title only when it looks like a Pi state. Otherwise it expands to nothing.

## Install

Install both sides: the tmux plugin with TPM, and the Pi extension with `pi install`.

### 1. Install the tmux plugin with TPM

Add the plugin to your tmux config before the TPM bootstrap line:

```tmux
set -g @plugin 'DRoma82/tmux-pi-state'
```

Then press `prefix + I` to install it with TPM, or run TPM's install script.

### 2. Install the Pi extension

Install this same repository as a Pi package:

```bash
pi install git:github.com/DRoma82/tmux-pi-state
```

For SSH:

```bash
pi install git:git@github.com:DRoma82/tmux-pi-state
```

Then restart Pi or run `/reload`.

> If you also have a manually copied `tmux-pi-state.ts` in `~/.pi/agent/extensions/`, remove it before installing the package to avoid duplicate tmux title updates.

## Usage

Use `#{pi-state}` in any tmux option that this plugin interpolates. By default, it interpolates:

```text
window-status-format window-status-current-format
```

Example:

```tmux
set -ga window-status-format " #I: #W #{pi-state} "
set -ga window-status-current-format " #I: #W #{pi-state} "
```

If a pane title is `π:Working`, the window entry can render like:

```text
1: pi π:Working
```

If no Pi state is present, `#{pi-state}` renders empty.

## Options

### `@pi_state_interpolated_options`

Space-separated tmux options where `#{pi-state}` should be replaced.

Default:

```tmux
set -g @pi_state_interpolated_options 'window-status-format window-status-current-format'
```

Example including the status bar:

```tmux
set -g @pi_state_interpolated_options 'status-left status-right window-status-format window-status-current-format'
```

### `PI_TMUX_STATE`

Set to `0` to disable the Pi extension without uninstalling the package:

```bash
PI_TMUX_STATE=0 pi
```

## How it works

TPM executes `tmux-pi-state.tmux`, which replaces literal `#{pi-state}` placeholders in configured tmux options with a script-backed tmux format:

```tmux
#(.../scripts/pi-state.sh "#{pane_id}")
```

The helper script reads that pane's title and prints it only when it starts with `π:`.

The Pi extension listens for Pi lifecycle events and updates the current pane title:

- `agent_start` -> `π:Working`
- `agent_settled` / idle -> `π:Waiting`

On shutdown, it restores the pane's original title.
