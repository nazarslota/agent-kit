import {basename} from "node:path";
import {shortModelName} from "../core/format.js";
import type {StatusSnapshot, TokenTotals} from "../core/types.js";
import {compactThreshold} from "./compaction.js";
import type {ClaudeStatusInput} from "./input.js";

/** Everything outside the JSON input the snapshot depends on; injected so tests stay pure. */
export interface Environment {
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly cwd: string;
    readonly gitBranch: (dir: string) => string | undefined;
    readonly readSettings: () => Readonly<Record<string, unknown>>;
    readonly readTranscript: (path: string) => TokenTotals | undefined;
}

export function toSnapshot(input: ClaudeStatusInput, environment: Environment): StatusSnapshot {
    const dir = input.cwd ?? environment.cwd;
    const window = input.contextWindow ?? 0;

    return {
        label: environment.env.AGENT_KIT_LABEL || undefined,
        repo: basename(dir) || dir,
        branch: environment.gitBranch(dir),
        model: shortModelName(input.modelName ?? "no model"),
        reasoning: input.thinking ? "thinking" : undefined,
        context: {
            used: input.contextUsed,
            window,
            compactAt: compactThreshold(input.contextWindow, {
                envWindow: environment.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW,
                settingsWindow: environment.readSettings().autoCompactWindow,
                envBuffer: environment.env.AGENT_KIT_CLAUDE_COMPACT_BUFFER,
            }),
        },
        tokens: input.transcriptPath ? environment.readTranscript(input.transcriptPath) : undefined,
    };
}
