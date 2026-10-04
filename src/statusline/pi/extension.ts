// Pi footer extension: the same status line as the Claude Code command, drawn with Pi's theme.
// Loaded through the "pi.extensions" entry in package.json.

import type {ExtensionAPI} from "@earendil-works/pi-coding-agent";
import {truncateToWidth} from "@earendil-works/pi-tui";
import {render} from "../core/layout.js";
import type {Painter, Role} from "../core/types.js";
import {type PiUsage, sumUsage, toSnapshot} from "./snapshot.js";

type ThemeColor = "accent" | "success" | "warning" | "error" | "dim" | "text" | "borderMuted";

const colors: Record<Role, ThemeColor> = {
    label: "warning",
    repo: "accent",
    branch: "success",
    model: "text",
    muted: "dim",
    track: "borderMuted",
    normal: "accent",
    warning: "warning",
    error: "error",
};

const boldRoles: ReadonlySet<Role> = new Set(["repo", "model"]);

function* assistantUsages(entries: readonly unknown[]): Iterable<PiUsage | undefined> {
    for (const entry of entries as ReadonlyArray<{type?: string; message?: {role?: string; usage?: PiUsage}}>) {
        if (entry.type === "message" && entry.message?.role === "assistant") yield entry.message.usage;
    }
}

export default function statusline(pi: ExtensionAPI): void {
    pi.on("session_start", async (_event, ctx) => {
        if (ctx.mode !== "tui") return;

        ctx.ui.setFooter((tui, theme, footerData) => {
            const paint: Painter = (segment) => {
                if (segment.role === undefined) return segment.text;
                const colored = theme.fg(colors[segment.role], segment.text);
                return boldRoles.has(segment.role) ? theme.bold(colored) : colored;
            };
            const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

            return {
                dispose: unsubscribe,
                invalidate() {},
                render(width: number): string[] {
                    const snapshot = toSnapshot({
                        cwd: ctx.sessionManager.getCwd(),
                        branch: footerData.getGitBranch() ?? undefined,
                        model: ctx.model,
                        thinkingLevel: ctx.thinkingLevel,
                        usage: ctx.getContextUsage(),
                        compaction: pi.getSettings().compaction,
                        tokens: sumUsage(assistantUsages(ctx.sessionManager.getEntries())),
                    });
                    return [truncateToWidth(render(snapshot, paint), width, "…")];
                },
            };
        });
    });
}
