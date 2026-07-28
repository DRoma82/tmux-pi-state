import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const TMUX_TIMEOUT_MS = 500;

type PiTmuxState = "working" | "waiting";

const STATE_SUFFIXES: Record<PiTmuxState, string> = {
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
	let originalWindowName: string | undefined;
	let originalAutomaticRename: string | undefined;
	let agentActive = false;
	let lastState: PiTmuxState | undefined;
	let updateQueue = Promise.resolve();
	let rootSession = false;

	async function captureOriginalWindowState() {
		if (windowId === undefined) {
			windowId = await tmux(["display-message", "-p", "-t", paneId, "#{window_id}"]);
		}
		if (windowId === undefined) {
			return;
		}
		if (originalWindowName === undefined) {
			originalWindowName = (await tmux(["display-message", "-p", "-t", windowId, "#{window_name}"])) ?? "";
		}
		if (originalAutomaticRename === undefined) {
			const windowValue = await tmux(["show-window-options", "-v", "-t", windowId, "automatic-rename"]);
			originalAutomaticRename = windowValue || (await tmux(["show-window-options", "-g", "-v", "automatic-rename"])) || "on";
		}
	}

	function desiredState(): PiTmuxState {
		return agentActive ? "working" : "waiting";
	}

	function setWindowName(name: string): Promise<void> {
		updateQueue = updateQueue
			.then(async () => {
				await captureOriginalWindowState();
				if (windowId === undefined) {
					return;
				}
				await tmux(["rename-window", "-t", windowId, name]);
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
		const base = originalWindowName ?? "";
		const name = base ? `${base} ${STATE_SUFFIXES[state]}` : STATE_SUFFIXES[state];
		void setWindowName(name);
	}

	async function restoreWindowState(): Promise<void> {
		if (windowId === undefined || originalWindowName === undefined) {
			return;
		}
		await tmux(["rename-window", "-t", windowId, originalWindowName]);
		if (originalAutomaticRename === "on") {
			await tmux(["set-window-option", "-t", windowId, "automatic-rename", "on"]);
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx?.hasUI !== true) {
			return;
		}
		rootSession = true;
		agentActive = ctx?.isIdle?.() === false;
		await captureOriginalWindowState();
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
		await restoreWindowState();
	});
}
