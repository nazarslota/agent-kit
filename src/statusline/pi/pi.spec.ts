import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {plain, render} from "../core/layout.js";
import {compactThreshold, DEFAULT_RESERVE_TOKENS, type PiState, sumUsage, toSnapshot} from "./snapshot.js";

const model = {provider: "claude-bridge", id: "claude-opus-5-5", contextWindow: 1_000_000};

const state: PiState = {
    cwd: "/work/agent-kit",
    branch: "main",
    model,
    thinkingLevel: "high",
    usage: {tokens: 421_000, contextWindow: 1_000_000},
    compaction: undefined,
    tokens: {input: 890_000, output: 8_400},
};

describe("Pi compactThreshold", () => {
    it("uses the default reserve", () => {
        assert.equal(compactThreshold(1_000_000, model, undefined), 1_000_000 - DEFAULT_RESERVE_TOKENS);
    });

    it("prefers a per-model override, then the global reserve", () => {
        const compaction = {reserveTokens: 20_000, modelOverrides: {"claude-bridge/claude-opus-5-5": {reserveTokens: 400_000}}};
        assert.equal(compactThreshold(1_000_000, model, compaction), 600_000);
        assert.equal(compactThreshold(1_000_000, {...model, id: "other"}, compaction), 980_000);
    });

    it("is undefined when compaction is disabled", () => {
        assert.equal(compactThreshold(1_000_000, model, {enabled: false}), undefined);
    });
});

describe("Pi status line", () => {
    it("renders like the Claude line", () => {
        assert.equal(
            render(toSnapshot(state), plain),
            "◆ agent-kit · ⎇ main │ claude-opus-5-5 · high │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k ⇥563k",
        );
    });

    it("hides reasoning when off and usage when unknown", () => {
        const line = render(
            toSnapshot({...state, thinkingLevel: "off", tokens: undefined, usage: {tokens: null, contextWindow: 1_000_000}}),
            plain,
        );
        assert.equal(line, "◆ agent-kit · ⎇ main │ claude-opus-5-5 │ ────────── 0% of 1M");
    });
});

describe("sumUsage", () => {
    it("adds input and cache writes, and output", () => {
        assert.deepEqual(sumUsage([{input: 10, cacheWrite: 1_000, output: 200}, undefined, {input: 5, output: 80}]), {
            input: 1_015,
            output: 280,
        });
    });
});
