import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const TMUX_TIMEOUT_MS = 500;

type PiTmuxState = "working" | "waiting";

const STATE_VALUES: Record<PiTmuxState, string> = {
	working: "π:\uF013", // nf-fa-cog
	waiting: "π:\uF00C", // nf-fa-check
};

function enabled(): boolean {
	return process.env.PI_TMUX_STATE !== "0" && !!process.env.TMUX && !!process.env.TMUX_PANE;
}

async function tmux(args: string[]): Promise<string | undefined> {
	if (!enabled()) {
		return undefined;
	}

	try {
		const { stdout } = await execFileAsync("tmux", args, { timeout: TMUX_TIMEOUT_MS });
		return stdout.trimEnd();
	} catch {
		return undefined;
	}
}

export default function (pi: ExtensionAPI) {
	if (!enabled()) {
		return;
	}

	const paneId = process.env.TMUX_PANE!;
	let windowId: string | undefined;
	let agentActive = false;
	let lastState: PiTmuxState | undefined;
	let updateQueue = Promise.resolve();
	let rootSession = false;

	async function captureWindowId() {
		if (windowId === undefined) {
			windowId = await tmux(["display-message", "-p", "-t", paneId, "#{window_id}"]);
		}
	}

	function desiredState(): PiTmuxState {
		return agentActive ? "working" : "waiting";
	}

	function setWindowState(value: string): Promise<void> {
		updateQueue = updateQueue
			.then(async () => {
				await captureWindowId();
				if (windowId === undefined) {
					return;
				}
				await tmux(["set-option", "-wq", "-t", windowId, "@pi_state", value]);
				await tmux(["refresh-client", "-S"]);
			})
			.catch(() => undefined);
		return updateQueue;
	}

	function publishState(force = false): void {
		const state = desiredState();
		if (!force && state === lastState) {
			return;
		}
		lastState = state;
		void setWindowState(STATE_VALUES[state]);
	}

	async function clearWindowState(): Promise<void> {
		if (windowId === undefined) {
			return;
		}
		await tmux(["set-option", "-wqu", "-t", windowId, "@pi_state"]);
		await tmux(["refresh-client", "-S"]);
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx?.hasUI !== true) {
			return;
		}
		rootSession = true;
		agentActive = ctx?.isIdle?.() === false;
		await captureWindowId();
		publishState(true);
	});

	pi.on("agent_start", () => {
		if (!rootSession) {
			return;
		}
		agentActive = true;
		publishState();
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (!rootSession || ctx?.isIdle?.() !== true) {
			return;
		}
		agentActive = false;
		publishState();
	});

	pi.on("session_shutdown", async () => {
		if (!rootSession) {
			return;
		}
		await updateQueue;
		await clearWindowState();
	});
}
