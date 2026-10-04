// Loads the Pi extension against a fake Pi API and renders the footer it registers.

import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {ExtensionAPI, ExtensionContext, ReadonlyFooterDataProvider, Theme} from "@earendil-works/pi-coding-agent";
import statusline from "./extension.js";

type Handler = (event: unknown, ctx: unknown) => Promise<void> | void;
type FooterFactory = (
    tui: unknown,
    theme: unknown,
    footerData: unknown,
) => {
    render(width: number): string[];
    dispose(): void;
};

interface Options {
    readonly mode?: string;
    readonly compaction?: Record<string, unknown>;
}

/** Loads the extension, fires session_start and returns the footer component it set, if any. */
async function loadFooter(options: Options = {}) {
    const handlers = new Map<string, Handler>();
    const settings = {
        getSettings: () => ({compaction: options.compaction}) as ReturnType<ExtensionAPI["getSettings"]>,
    } satisfies Pick<ExtensionAPI, "getSettings">;
    const on = (event: string, handler: Handler) => handlers.set(event, handler);
    statusline({...settings, on} as unknown as ExtensionAPI);

    let factory: FooterFactory | undefined;
    let renderRequests = 0;
    let branchListener: (() => void) | undefined;
    const ctx = {
        mode: options.mode ?? "tui",
        model: {provider: "claude-bridge", id: "claude-opus-5-5", contextWindow: 1_000_000},
        thinkingLevel: "high",
        ...({getContextUsage: () => ({tokens: 421_000, contextWindow: 1_000_000, percent: 42.1})} satisfies Pick<
            ExtensionContext,
            "getContextUsage"
        >),
        sessionManager: {
            getCwd: () => "/work/agent-kit",
            getEntries: () =>
                [
                    {type: "message", message: {role: "user"}},
                    {type: "message", message: {role: "assistant", usage: {input: 10, cacheWrite: 889_990, output: 8_000}}},
                    {type: "message", message: {role: "assistant", usage: {input: 0, cacheWrite: 0, output: 400}}},
                ] as unknown as ReturnType<ExtensionContext["sessionManager"]["getEntries"]>,
        } satisfies Pick<ExtensionContext["sessionManager"], "getCwd" | "getEntries">,
        ui: {
            setFooter: (f: unknown) => {
                factory = f as FooterFactory;
            },
        } satisfies Pick<ExtensionContext["ui"], "setFooter">,
    };
    await handlers.get("session_start")?.({}, ctx);

    // Like a real Pi theme, color with zero-width ANSI codes, so width-based truncation sees real text.
    const theme = {
        fg: (color: string, text: string) => `\x1b[${CODES[color] ?? 39}m${text}\x1b[39m`,
        bold: (text: string) => `\x1b[1m${text}\x1b[22m`,
    } satisfies Pick<Theme, "fg" | "bold">;
    const footerData = {
        getGitBranch: () => "main",
        onBranchChange: (listener: () => void) => {
            branchListener = listener;
            return () => {
                branchListener = undefined;
            };
        },
    } satisfies Pick<ReadonlyFooterDataProvider, "getGitBranch" | "onBranchChange">;
    const component = factory?.({requestRender: () => renderRequests++}, theme, footerData);
    return {component, handlers, fireBranchChange: () => branchListener?.(), renderRequests: () => renderRequests};
}

/** ANSI foreground codes for the theme colors the extension uses. */
const CODES: Record<string, number> = {accent: 36, success: 32, warning: 33, error: 31, dim: 2, text: 37, borderMuted: 90};

// biome-ignore lint/suspicious/noControlCharactersInRegex: matches the ANSI escape character on purpose.
const strip = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

describe("Pi extension", () => {
    it("registers a session_start handler", async () => {
        const {handlers} = await loadFooter();
        assert.ok(handlers.has("session_start"));
    });

    it("renders the status line in the footer", async () => {
        const {component} = await loadFooter();
        const lines = component?.render(200) ?? [];
        assert.equal(lines.length, 1);
        assert.equal(strip(lines[0] ?? ""), "◆ agent-kit  main │ claude-opus-5-5 high │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k · ⇥563k");
    });

    it("colors through the Pi theme", async () => {
        const line = (await loadFooter()).component?.render(200)[0] ?? "";
        assert.ok(line.includes("\x1b[1m\x1b[36m◆ agent-kit"), JSON.stringify(line));
        assert.ok(line.includes("\x1b[32m  main"), JSON.stringify(line));
        assert.ok(line.includes("\x1b[90m──────"), JSON.stringify(line));
    });

    it("uses the compaction reserve from settings", async () => {
        const {component} = await loadFooter({compaction: {reserveTokens: 400_000}});
        assert.ok(strip(component?.render(200)[0] ?? "").endsWith("⇥179k"));
    });

    it("truncates to the terminal width", async () => {
        const line = (await loadFooter()).component?.render(30)[0] ?? "";
        assert.ok(strip(line).length <= 30, strip(line));
        assert.ok(strip(line).endsWith("…"), strip(line));
    });

    it("redraws on a branch change and unsubscribes on dispose", async () => {
        const footer = await loadFooter();
        footer.fireBranchChange();
        assert.equal(footer.renderRequests(), 1);
        footer.component?.dispose();
        footer.fireBranchChange();
        assert.equal(footer.renderRequests(), 1);
    });

    it("leaves the footer alone outside the TUI", async () => {
        assert.equal((await loadFooter({mode: "rpc"})).component, undefined);
    });
});
