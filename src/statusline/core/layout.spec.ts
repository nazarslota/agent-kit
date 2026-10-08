import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {layout, plain, render} from "./layout.js";
import type {StatusSnapshot} from "./types.js";

const base: StatusSnapshot = {
    label: undefined,
    repo: "agent-kit",
    branch: "main",
    model: "Opus 5.5",
    reasoning: "thinking",
    context: {used: 421_000, window: 1_000_000, compactAt: 967_000},
    tokens: {input: 890_000, output: 8_400},
};

describe("layout", () => {
    it("renders the full line", () => {
        assert.equal(render(base, plain), "◆ agent-kit · ⎇ main │ Opus 5.5 · thinking │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k ⇥546k");
    });

    it("ends with the label and omits missing parts", () => {
        const line = render({...base, label: "work", branch: undefined, reasoning: undefined, tokens: undefined}, plain);
        assert.equal(line, "◆ agent-kit │ Opus 5.5 │ ━━━━────── 421k/1M 42% ⇥546k │ work");
    });

    it("pushes the label to the right edge when the width is known", () => {
        const line = render({...base, label: "work", tokens: undefined}, plain, 80);
        assert.equal(line.length, 80);
        assert.match(line, /⇥546k {2,}work$/);
        // Too narrow to pad: falls back to the separator.
        assert.match(render({...base, label: "work"}, plain, 40), /⇥546k │ work$/);
    });

    it("warns when compaction is due and colors by level", () => {
        const segments = layout({...base, context: {used: 980_000, window: 1_000_000, compactAt: 967_000}});
        assert.equal(segments.at(-1)?.text, "compact soon");
        assert.equal(segments.at(-1)?.role, "error");
        assert.ok(segments.some((segment) => segment.text === "━".repeat(10) && segment.role === "error"));
    });

    it("drops the countdown when usage is unknown", () => {
        assert.equal(
            render({...base, tokens: undefined, context: {used: undefined, window: 200_000, compactAt: 193_400}}, plain),
            "◆ agent-kit · ⎇ main │ Opus 5.5 · thinking │ ────────── 0% of 200k",
        );
    });
});
