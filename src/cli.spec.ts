// Runs the built CLI the way a user and Claude Code do.

import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {after, describe, it} from "node:test";
import {fileURLToPath} from "node:url";

const CLI = fileURLToPath(new URL("./cli.js", import.meta.url));

/** Temp dirs the tests make; removed when the file's tests finish. */
const tempDirs: string[] = [];

function tempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}

after(() => {
    for (const dir of tempDirs) rmSync(dir, {recursive: true, force: true});
});

function run(args: string[], configDir: string, input = ""): {stdout: string; status: number | null} {
    const result = spawnSync(process.execPath, [CLI, ...args], {
        input,
        encoding: "utf8",
        env: {PATH: process.env.PATH ?? "", CLAUDE_CONFIG_DIR: configDir},
    });
    return {stdout: result.stdout, status: result.status};
}

describe("agent-kit CLI", () => {
    it("setup claude writes statusLine and keeps other settings", () => {
        const dir = tempDir("claude-config-");
        writeFileSync(join(dir, "settings.json"), JSON.stringify({model: "opus"}));
        assert.equal(run(["setup", "claude"], dir).status, 0);
        assert.deepEqual(JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")), {
            model: "opus",
            statusLine: {type: "command", command: "agent-kit statusline", padding: 0},
        });
    });

    it("uninstall claude removes only its own status line", () => {
        const dir = tempDir("claude-config-");
        writeFileSync(join(dir, "settings.json"), JSON.stringify({model: "opus"}));
        run(["setup", "claude"], dir);
        assert.equal(run(["uninstall", "claude"], dir).status, 0);
        assert.deepEqual(JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")), {model: "opus"});

        const mine = JSON.stringify({statusLine: {type: "command", command: "~/mine.sh"}});
        writeFileSync(join(dir, "settings.json"), mine);
        run(["uninstall", "claude"], dir);
        assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), mine);
    });

    it("statusline prints the line", () => {
        const {stdout, status} = run(["statusline"], tempDir("claude-config-"), JSON.stringify({workspace: {current_dir: "/tmp"}}));
        assert.equal(status, 0);
        assert.match(stdout, /◆ .*tmp/);
    });

    it("prints usage and fails on an unknown command", () => {
        const {stdout, status} = run(["nope"], tempDir("claude-config-"));
        assert.equal(status, 1);
        assert.match(stdout, /^Usage:/);
    });
});
