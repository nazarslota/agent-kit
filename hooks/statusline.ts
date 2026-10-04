// Claude Code plugin: the agent-kit status line, drawn through the plugin API instead of a
// settings.json statusLine command. Unlike the command, the plugin reads Claude's real
// auto-compact threshold, so the countdown is exact.
//
// The engine runs this module without Node; it only imports the pure core/ code.

import type {EngineInterface, Register} from "claude-code";
import {modelLabel} from "../src/statusline/core/format.js";
import {plain, render} from "../src/statusline/core/layout.js";
import {sumTranscript} from "../src/statusline/core/transcript.js";
import type {StatusSnapshot, TokenTotals} from "../src/statusline/core/types.js";

/** Path of the session transcript, taken from the classic hook events that carry it. */
let transcriptPath: string | undefined;

function basename(path: string): string {
    const trimmed = path.replace(/\/+$/, "");
    return trimmed.slice(trimmed.lastIndexOf("/") + 1) || trimmed;
}

async function gitBranch($: EngineInterface, cwd: string): Promise<string | undefined> {
    try {
        const result = await $.process.run(["git", "--no-optional-locks", "branch", "--show-current"], {cwd});
        const branch = result.stdout.trim();
        return result.exitCode === 0 && branch ? branch : undefined;
    } catch {
        return undefined;
    }
}

async function tokenTotals($: EngineInterface): Promise<TokenTotals | undefined> {
    if (!transcriptPath) return undefined;
    try {
        return sumTranscript(await $.fs.read(transcriptPath));
    } catch {
        return undefined;
    }
}

async function snapshot($: EngineInterface): Promise<StatusSnapshot> {
    const [usage, model, cwd, label] = await Promise.all([
        $.session.usage({breakdown: "summary"}),
        $.session.model(),
        $.session.cwd(),
        $.env.get("AGENT_KIT_LABEL"),
    ]);
    const breakdown = usage.context.breakdown;

    return {
        label: label || undefined,
        repo: basename(cwd),
        branch: await gitBranch($, cwd),
        model: modelLabel(model),
        reasoning: undefined,
        context: {
            used: usage.context.tokens,
            window: usage.context.window,
            compactAt: breakdown?.isAutoCompactEnabled ? breakdown.autoCompactThreshold : undefined,
        },
        tokens: await tokenTotals($),
    };
}

async function refresh($: EngineInterface): Promise<void> {
    try {
        $.ui.status(render(await snapshot($), plain));
    } catch {
        // Keep the previous line rather than failing a session event.
    }
}

export const register: Register = (on) => {
    on("session.start", async ($, e, next) => {
        const result = await next(e);
        await refresh($);
        return result;
    });

    // Fires after each main-thread turn and when a rate-limit window moves.
    on("session.measure", async ($, e, next) => {
        const result = await next(e);
        await refresh($);
        return result;
    });

    // The classic SessionStart and Stop events are the ones that carry the transcript path.
    on("classic.SessionStart", async (_$, e, next) => {
        transcriptPath = e.transcript_path || transcriptPath;
        return next(e);
    });

    on("classic.Stop", async ($, e, next) => {
        transcriptPath = e.transcript_path || transcriptPath;
        const result = await next(e);
        await refresh($);
        return result;
    });
};
