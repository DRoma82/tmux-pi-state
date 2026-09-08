# tmux-pi-state

Pi package that exposes Pi coding-agent state to tmux as window/pane-scoped user options.

Each Pi instance sets `@pi_pane_state` on its own tmux pane, then the extension aggregates all Pi pane states in that window into `@pi_state`:

```text
π:      # one working Pi pane
π:      # one waiting Pi pane
π:      # one Pi pane finished while its window was inactive
π:     # two waiting Pi panes in the same window
π:     # one waiting, one working
π:     # one waiting, one unseen background completion
```

Glyphs:

- working: `nf-fa-cog` U+F013
- asking (waiting for your input on an `ask_user_question` prompt): `nf-fa-question_circle` U+F059
- waiting: `nf-fa-check` U+F00C
- unseen/background completion: `nf-fa-exclamation_circle` U+F06A

Render it anywhere tmux formats are supported, usually next to `#W` in the window status format:

```tmux
set -ga window-status-format " #I: #W #{@pi_state} "
set -ga window-status-current-format " #I: #W #{@pi_state} "
```

This avoids racing other window renamers: Pi does not call `rename-window`; it only updates tmux user options. Tools such as `tmux-window-name` can continue owning the actual window name, while the status line displays Pi state alongside it.

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

The Pi extension listens for Pi lifecycle events and updates tmux options:

- `session_start` -> for interactive sessions, captures the current tmux window ID and publishes the initial working or waiting state
- `agent_start` -> sets this pane's `@pi_pane_state` to the gear icon, then recomputes window `@pi_state`
- `tool_execution_start` / `tool_execution_end` for the `ask_user_question` tool -> while the prompt is awaiting your input, sets this pane's `@pi_pane_state` to the question-circle icon, then reverts to the gear icon once you answer
- `agent_settled` / idle while window is active -> sets this pane's `@pi_pane_state` to the check icon, then recomputes window `@pi_state`
- `agent_settled` / idle after finishing while window is inactive -> sets this pane's `@pi_pane_state` to the exclamation-circle icon, then recomputes window `@pi_state`
- `session_shutdown` -> unsets this pane's `@pi_pane_state`, then recomputes or unsets window `@pi_state`

No tmux-side plugin is required. The glyphs require a Nerd Font in your terminal.

## Options

### `PI_TMUX_STATE`

Set to `0` to disable the Pi extension without uninstalling the package:

```bash
PI_TMUX_STATE=0 pi
```

## Notes

- `@pi_state` is ordered by tmux pane order in the window.
- If a Pi process exits cleanly, it removes only its own pane state and leaves other Pi pane states intact.
- The unseen/background-completion marker is extension-only: it does not auto-clear on focus. It changes the next time that Pi instance publishes a state, such as when it starts working again or shuts down.
- If Pi crashes while its pane remains open, that pane's `@pi_pane_state` remains stale until the pane closes or the option is cleared manually. If tmux closes the pane, the window's `@pi_state` may remain stale until another Pi state update recomputes it.
- Because state is stored as tmux options rather than baked into `window_name`, it survives pane switches and does not interfere with automatic/window-name plugins.
