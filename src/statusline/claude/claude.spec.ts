import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {plain, render} from "../core/layout.js";
import {compactThreshold} from "./compaction.js";
import {parseInput} from "./input.js";
import {type Environment, toSnapshot} from "./snapshot.js";

// Shape captured from Claude Code 2.1.289.
const sample = JSON.stringify({
    cwd: "/work/agent-kit/src",
    transcript_path: "/tmp/session.jsonl",
    model: {id: "claude-opus-5-5", display_name: "Opus 5.5 (1M context)"},
    workspace: {current_dir: "/work/agent-kit/src", project_dir: "/work/agent-kit"},
    context_window: {
        context_window_size: 1_000_000,
        current_usage: {input_tokens: 1_000, cache_creation_input_tokens: 20_000, cache_read_input_tokens: 400_000},
        used_percentage: 42,
    },
    thinking: {enabled: true},
    effort: {level: "high"},
});

function environment(overrides: Partial<Environment> = {}): Environment {
    return {
        env: {},
        cwd: "/fallback",
        gitBranch: () => "main",
        gitRoot: () => undefined,
        readSettings: () => ({}),
        readTranscript: () => ({input: 890_000, output: 8_400}),
        ...overrides,
    };
}

describe("parseInput", () => {
    it("reads the fields the line needs", () => {
        assert.deepEqual(parseInput(sample), {
            cwd: "/work/agent-kit/src",
            projectDir: "/work/agent-kit",
            transcriptPath: "/tmp/session.jsonl",
            modelName: "Opus 5.5 (1M context)",
            thinking: true,
            effort: "high",
            contextWindow: 1_000_000,
            contextUsed: 421_000,
        });
    });

    it("keeps usage unknown before the first response", () => {
        assert.equal(
            parseInput(JSON.stringify({context_window: {context_window_size: 200_000, current_usage: null}})).contextUsed,
            undefined,
        );
    });

    it("survives invalid and unexpected input", () => {
        for (const raw of ["", "not json", "[]", "null", JSON.stringify({model: 5, context_window: {context_window_size: -1}})]) {
            const input = parseInput(raw);
            assert.equal(input.contextWindow, undefined);
            assert.equal(input.thinking, false);
        }
    });
});

describe("compactThreshold", () => {
    it("subtracts the summary buffer from the model window", () => {
        assert.equal(compactThreshold(1_000_000, {envWindow: undefined, settingsWindow: undefined, envBuffer: undefined}), 967_000);
    });

    it("prefers the env window over settings, capped at the model window", () => {
        assert.equal(compactThreshold(1_000_000, {envWindow: "500000", settingsWindow: 400_000, envBuffer: undefined}), 483_500);
        assert.equal(compactThreshold(1_000_000, {envWindow: undefined, settingsWindow: 400_000, envBuffer: undefined}), 386_800);
        assert.equal(compactThreshold(200_000, {envWindow: "500000", settingsWindow: undefined, envBuffer: undefined}), 193_400);
    });

    it("accepts a buffer override and ignores invalid values", () => {
        assert.equal(compactThreshold(1_000_000, {envWindow: "abc", settingsWindow: "x", envBuffer: "50000"}), 950_000);
        assert.equal(compactThreshold(undefined, {envWindow: undefined, settingsWindow: undefined, envBuffer: undefined}), undefined);
    });
});

describe("Claude status line", () => {
    it("renders the captured sample", () => {
        assert.equal(
            render(toSnapshot(parseInput(sample), environment()), plain),
            "◆ agent-kit · ⎇ main │ Opus 5.5 · high │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k ⇥546k",
        );
    });

    it("names the repo after the git root, not the current subdirectory", () => {
        const snapshot = toSnapshot(parseInput(sample), environment({gitRoot: () => "/repos/agent-kit-main"}));
        assert.equal(snapshot.repo, "agent-kit-main");
    });

    it("falls back to thinking without an effort level", () => {
        const input = parseInput(JSON.stringify({thinking: {enabled: true}}));
        assert.equal(toSnapshot(input, environment()).reasoning, "thinking");
        assert.equal(toSnapshot(parseInput("{}"), environment()).reasoning, undefined);
    });

    it("shows AGENT_KIT_LABEL and falls back to the process cwd", () => {
        const snapshot = toSnapshot(parseInput("{}"), environment({env: {AGENT_KIT_LABEL: "work"}, gitBranch: () => undefined}));
        assert.equal(snapshot.label, "work");
        assert.equal(snapshot.repo, "fallback");
        assert.equal(toSnapshot(parseInput("{}"), environment()).label, undefined);
    });

    it("hides totals without a transcript", () => {
        assert.equal(toSnapshot(parseInput("{}"), environment()).tokens, undefined);
    });

    it("uses autoCompactWindow from settings", () => {
        const snapshot = toSnapshot(parseInput(sample), environment({readSettings: () => ({autoCompactWindow: 500_000})}));
        assert.equal(snapshot.context.compactAt, 483_500);
    });
});
