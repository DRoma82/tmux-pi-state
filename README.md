# tmux-pi-state

Pi package that exposes Pi coding-agent state to tmux as a window-scoped user option.

The extension sets `@pi_state` on the tmux window where Pi was started:

```text
π:  # working, nf-fa-cog U+F013
π:  # waiting, nf-fa-check U+F00C
```

Render it anywhere tmux formats are supported, usually next to `#W` in the window status format:

```tmux
set -ga window-status-format " #I: #W #{@pi_state} "
set -ga window-status-current-format " #I: #W #{@pi_state} "
```

This avoids racing other window renamers: Pi does not call `rename-window`; it only updates the `@pi_state` cache. Tools such as `tmux-window-name` can continue owning the actual window name, while the status line displays Pi state alongside it.

## Install

```bash
pi install git:github.com/DRoma82/tmux-pi-state
```

For SSH:

```bash
pi install git:git@github.com:DRoma82/tmux-pi-state
```

Then restart Pi or run `/reload`.

> If you also have a manually copied `tmux-pi-state.ts` in `~/.pi/agent/extensions/`, remove it before installing the package to avoid duplicate updates.

## How it works

The Pi extension listens for Pi lifecycle events and updates a tmux window option:

- `session_start` -> captures the current tmux window ID
- `agent_start` -> sets `@pi_state` to `π:` + gear icon
- `agent_settled` / idle -> sets `@pi_state` to `π:` + check icon
- `session_shutdown` -> unsets `@pi_state`

No tmux-side plugin is required. The glyphs require a Nerd Font in your terminal.

## Options

### `PI_TMUX_STATE`

Set to `0` to disable the Pi extension without uninstalling the package:

```bash
PI_TMUX_STATE=0 pi
```

## Notes

- This only tracks Pi state for the window where Pi was started. If you have multiple Pi sessions open in different panes of the same window, only the last one to update `@pi_state` wins.
- Because the state is stored as a tmux window option rather than baked into `window_name`, it survives pane switches and does not interfere with automatic/window-name plugins.
