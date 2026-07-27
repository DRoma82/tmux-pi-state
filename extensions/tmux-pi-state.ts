import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const TMUX_TIMEOUT_MS = 500;

type PiTmuxState = "working" | "waiting";

const STATE_TITLES: Record<PiTmuxState, string> = {
	working: "π: ⏳ working",
	waiting: "π: ⏸ waiting",
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
	let originalPaneTitle: string | undefined;
	let agentActive = false;
	let lastState: PiTmuxState | undefined;
	let updateQueue = Promise.resolve();
	let rootSession = false;

	async function captureOriginalPaneTitle() {
		if (originalPaneTitle === undefined) {
			originalPaneTitle = (await tmux(["display-message", "-p", "-t", paneId, "#{pane_title}"])) ?? "";
		}
	}

	function desiredState(): PiTmuxState {
		return agentActive ? "working" : "waiting";
	}

	function setPaneTitle(title: string): Promise<void> {
		updateQueue = updateQueue
			.then(async () => {
				await captureOriginalPaneTitle();
				await tmux(["select-pane", "-t", paneId, "-T", title]);
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
		void setPaneTitle(STATE_TITLES[state]);
	}

	async function restorePaneTitle(): Promise<void> {
		if (originalPaneTitle !== undefined) {
			await tmux(["select-pane", "-t", paneId, "-T", originalPaneTitle]);
			await tmux(["refresh-client", "-S"]);
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx?.hasUI !== true) {
			return;
		}
		rootSession = true;
		agentActive = ctx?.isIdle?.() === false;
		await captureOriginalPaneTitle();
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
		await restorePaneTitle();
	});
}
