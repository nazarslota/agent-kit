// Runs the built status line command the way Claude Code does: JSON on stdin, one line on stdout.

import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";
import {fileURLToPath} from "node:url";

const MAIN = fileURLToPath(new URL("./main.js", import.meta.url));
// biome-ignore lint/suspicious/noControlCharactersInRegex: matches the ANSI escape character on purpose.
const ANSI = /\x1b\[[0-9;]*m/g;

function run(stdin: string, env: Record<string, string> = {}): {stdout: string; status: number | null} {
    const result = spawnSync(process.execPath, [MAIN], {
        input: stdin,
        encoding: "utf8",
        // A clean environment: no label, no compaction overrides, an empty Claude config dir.
        env: {PATH: process.env.PATH ?? "", CLAUDE_CONFIG_DIR: mkdtempSync(join(tmpdir(), "claude-config-")), ...env},
    });
    return {stdout: result.stdout.replace(ANSI, ""), status: result.status};
}

function session(): {dir: string; transcript: string} {
    const dir = mkdtempSync(join(tmpdir(), "agent-kit-"));
    const transcript = join(dir, "session.jsonl");
    writeFileSync(
        transcript,
        [
            JSON.stringify({
                type: "assistant",
                message: {id: "m1", usage: {input_tokens: 10, cache_creation_input_tokens: 889_990, output_tokens: 8_000}},
            }),
            JSON.stringify({type: "assistant", message: {id: "m2", usage: {input_tokens: 0, output_tokens: 400}}}),
        ].join("\n"),
    );
    return {dir, transcript};
}

describe("claude/main.js", () => {
    it("prints the full line for Claude's JSON", () => {
        const {dir, transcript} = session();
        const input = JSON.stringify({
            transcript_path: transcript,
            workspace: {current_dir: dir},
            model: {display_name: "Opus 5.5 (1M context)"},
            thinking: {enabled: true},
            context_window: {context_window_size: 1_000_000, current_usage: {cache_read_input_tokens: 421_000}},
        });
        const {stdout, status} = run(input);
        assert.equal(status, 0);
        // The temp dir isn't a git repo, so no branch shows.
        const repo = dir.slice(dir.lastIndexOf("/") + 1);
        assert.equal(stdout, `◆ ${repo} │ Opus 5.5 thinking │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k · ⇥546k\n`);
    });

    it("puts AGENT_KIT_LABEL in front", () => {
        const {stdout} = run(JSON.stringify({workspace: {current_dir: "/tmp"}}), {AGENT_KIT_LABEL: "work"});
        assert.ok(stdout.startsWith("work · ◆ tmp"), stdout);
    });

    it("prints a line and exits 0 on bad input", () => {
        for (const stdin of ["", "not json", "[1,2]", JSON.stringify({transcript_path: "/does/not/exist"})]) {
            const {stdout, status} = run(stdin);
            assert.equal(status, 0, stdin);
            assert.match(stdout, /^◆ .+\n$/, stdin);
        }
    });
});
