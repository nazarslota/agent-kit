import type {On} from "claude-code";
import {expect, test} from "claude-code/testing";

interface Fixture {
    readonly tokens?: number;
    readonly window: number;
    readonly threshold?: number;
    readonly label?: string;
}

const TRANSCRIPT = [
    JSON.stringify({
        type: "assistant",
        message: {id: "m1", usage: {input_tokens: 10, cache_creation_input_tokens: 889_990, output_tokens: 8_000}},
    }),
    JSON.stringify({type: "assistant", message: {id: "m2", usage: {input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 400}}}),
].join("\n");

/** The test's `on` hooks stand in for the engine beneath the plugin under test. */
function stubEngine(on: On, fixture: Fixture): Array<string | undefined> {
    const lines: Array<string | undefined> = [];
    on("session.usage", () => ({
        value: {
            context: {
                tokens: fixture.tokens,
                window: fixture.window,
                breakdown: {isAutoCompactEnabled: fixture.threshold !== undefined, autoCompactThreshold: fixture.threshold},
            },
        },
    }));
    on("session.model", () => ({value: "claude-opus-5-5"}));
    on("session.cwd", () => ({value: "/work/agent-kit"}));
    on("env.get", () => ({value: fixture.label}));
    on("process.run", () => ({value: {exitCode: 0, stdout: "main\n", stderr: ""}}));
    on("fs.read", () => ({value: TRANSCRIPT}));
    on("session.measure", (_$, e) => ({changed: e.changed}));
    on("classic.Stop", () => ({}));
    on("ui.status", (_$, e) => {
        lines.push(e.text);
        return {value: undefined};
    });
    return lines;
}

const measure = {context: {tokens: 421_000, window: 1_000_000}, rateLimits: [], changed: ["context" as const]};

test("draws the exact countdown after a turn", async ($, on) => {
    const lines = stubEngine(on, {tokens: 421_000, window: 1_000_000, threshold: 967_000});

    await $.session.measure(measure);

    expect(lines.at(-1)).toBe("◆ agent-kit  main │ Opus 5.5 │ ━━━━────── 421k/1M 42% · ⇥546k");
});

test("adds session totals once a Stop event names the transcript", async ($, on) => {
    const lines = stubEngine(on, {tokens: 421_000, window: 1_000_000, threshold: 967_000});

    await $.classic.Stop({transcript_path: "/tmp/session.jsonl", stop_hook_active: false});

    expect(lines.at(-1)).toBe("◆ agent-kit  main │ Opus 5.5 │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k · ⇥546k");
});

test("shows AGENT_KIT_LABEL in front", async ($, on) => {
    const lines = stubEngine(on, {tokens: 421_000, window: 1_000_000, threshold: 967_000, label: "work"});

    await $.session.measure(measure);

    expect(lines.at(-1)).toBe("work · ◆ agent-kit  main │ Opus 5.5 │ ━━━━────── 421k/1M 42% · ⇥546k");
});

test("omits the countdown when auto-compaction is off or usage is unknown", async ($, on) => {
    const lines = stubEngine(on, {window: 1_000_000});

    await $.session.measure({...measure, context: {window: 1_000_000}});

    expect(lines.at(-1)).toBe("◆ agent-kit  main │ Opus 5.5 │ ────────── 0% of 1M");
});
