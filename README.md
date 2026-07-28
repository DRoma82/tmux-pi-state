# tmux-pi-state

Pi package that shows Pi coding-agent state directly in the tmux window name.

The extension renames the current tmux window by appending a state suffix to its existing name:

```text
pi π:Working
pi π:Waiting
```

Because it renames the window (not just the pane), the state stays visible in `#W` / `window-status-format` even after you switch panes within that window.

## Install

```bash
pi install git:github.com/DRoma82/tmux-pi-state
```

For SSH:

```bash
pi install git:git@github.com:DRoma82/tmux-pi-state
```

Then restart Pi or run `/reload`.

> If you also have a manually copied `tmux-pi-state.ts` in `~/.pi/agent/extensions/`, remove it before installing the package to avoid duplicate window renames.

## How it works

The Pi extension listens for Pi lifecycle events and renames the current tmux window:

- `session_start` -> captures the window's original name and `automatic-rename` setting
- `agent_start` -> `<original name> π:Working`
- `agent_settled` / idle -> `<original name> π:Waiting`

On shutdown, it restores the window's original name and `automatic-rename` setting.

No tmux-side plugin or configuration is required — the renamed window name shows up automatically in any tmux status format that already references `#W` (window name), such as `window-status-format`.

## Options

### `PI_TMUX_STATE`

Set to `0` to disable the Pi extension without uninstalling the package:

```bash
PI_TMUX_STATE=0 pi
```

## Notes

- This only tracks Pi state for the pane where Pi was started (the "root" session). If you have multiple Pi sessions open in different panes of the same window, only the last one to update the window name wins.
- If `automatic-rename` was on for the window before Pi started, it is temporarily turned off while Pi manages the window name, then restored on shutdown.
