import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const TMUX_TIMEOUT_MS = 500;
const ASK_USER_QUESTION_TOOL = "ask_user_question";

type PiTmuxState = "working" | "asking" | "waiting" | "unseen";

const STATE_ICONS: Record<PiTmuxState, string> = {
	working: "\uF013", // nf-fa-cog
	asking: "\uF059", // nf-fa-question_circle
	waiting: "\uF00C", // nf-fa-check
	unseen: "\uF06A", // nf-fa-exclamation_circle
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
	let pendingQuestions = 0;
	let lastState: PiTmuxState | undefined;
	let updateQueue = Promise.resolve();
	let rootSession = false;

	async function captureWindowId() {
		if (windowId === undefined) {
			windowId = await tmux(["display-message", "-p", "-t", paneId, "#{window_id}"]);
		}
	}

	function desiredState(): PiTmuxState {
		if (pendingQuestions > 0) {
			return "asking";
		}
		return agentActive ? "working" : "waiting";
	}

	async function windowIsActive(): Promise<boolean> {
		await captureWindowId();
		if (windowId === undefined) {
			return true;
		}
		return (await tmux(["display-message", "-p", "-t", windowId, "#{window_active}"])) === "1";
	}

	async function publishWindowState() {
		await captureWindowId();
		if (windowId === undefined) {
			return;
		}

		const output = await tmux(["list-panes", "-t", windowId, "-F", "#{@pi_pane_state}"]);
		const icons = (output ?? "")
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		if (icons.length === 0) {
			await tmux(["set-option", "-wqu", "-t", windowId, "@pi_state"]);
		} else {
			await tmux(["set-option", "-wq", "-t", windowId, "@pi_state", `π:${icons.join(" ")}`]);
		}
		await tmux(["refresh-client", "-S"]);
	}

	function setPaneState(icon: string): Promise<void> {
		updateQueue = updateQueue
			.then(async () => {
				await tmux(["set-option", "-pq", "-t", paneId, "@pi_pane_state", icon]);
				await publishWindowState();
			})
			.catch(() => undefined);
		return updateQueue;
	}

	function publishState(state: PiTmuxState = desiredState(), force = false): void {
		if (!force && state === lastState) {
			return;
		}
		lastState = state;
		void setPaneState(STATE_ICONS[state]);
	}

	async function clearPaneState(): Promise<void> {
		await tmux(["set-option", "-pqu", "-t", paneId, "@pi_pane_state"]);
		await publishWindowState();
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx?.hasUI !== true) {
			return;
		}
		rootSession = true;
		agentActive = ctx?.isIdle?.() === false;
		await captureWindowId();
		publishState(desiredState(), true);
	});

	pi.on("agent_start", () => {
		if (!rootSession) {
			return;
		}
		agentActive = true;
		publishState();
	});

	pi.on("tool_execution_start", (event) => {
		if (!rootSession || event?.toolName !== ASK_USER_QUESTION_TOOL) {
			return;
		}
		pendingQuestions += 1;
		publishState();
	});

	pi.on("tool_execution_end", (event) => {
		if (!rootSession || event?.toolName !== ASK_USER_QUESTION_TOOL) {
			return;
		}
		pendingQuestions = Math.max(0, pendingQuestions - 1);
		publishState();
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (!rootSession || ctx?.isIdle?.() !== true) {
			return;
		}

		const finishedWork = agentActive;
		agentActive = false;

		void (async () => {
			const state = finishedWork && !(await windowIsActive()) ? "unseen" : "waiting";
			publishState(state);
		})();
	});

	pi.on("session_shutdown", async () => {
		if (!rootSession) {
			return;
		}
		await updateQueue;
		await clearPaneState();
	});
}
