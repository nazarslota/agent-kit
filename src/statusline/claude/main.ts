// Claude Code status line command. Claude pipes the session as JSON on stdin and shows what
// this prints. `agent-kit setup claude` configures it; by hand, in settings.json:
//   "statusLine": { "type": "command", "command": "agent-kit statusline", "padding": 0 }
//
// It must always print a line and exit 0: any failure degrades to a shorter line.

import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";
import {render} from "../core/layout.js";
import {sumTranscript} from "../core/transcript.js";
import {ansiPainter} from "./ansi.js";
import {parseInput} from "./input.js";
import {type Environment, toSnapshot} from "./snapshot.js";

const GIT_TIMEOUT_MS = 500;

function git(dir: string, ...args: string[]): string | undefined {
    try {
        const output = execFileSync("git", ["-C", dir, "--no-optional-locks", ...args], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: GIT_TIMEOUT_MS,
        }).trim();
        return output || undefined;
    } catch {
        return undefined;
    }
}

const gitBranch = (dir: string) => git(dir, "branch", "--show-current");
const gitRoot = (dir: string) => git(dir, "rev-parse", "--show-toplevel");

function readSettings(): Record<string, unknown> {
    try {
        const dir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
        const parsed: unknown = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"));
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function readTranscript(path: string): ReturnType<typeof sumTranscript> | undefined {
    try {
        return sumTranscript(readFileSync(path, "utf8"));
    } catch {
        return undefined;
    }
}

function readStdin(): string {
    try {
        return readFileSync(0, "utf8");
    } catch {
        return "";
    }
}

const environment: Environment = {
    env: process.env,
    cwd: process.cwd(),
    gitBranch,
    gitRoot,
    readSettings,
    readTranscript,
};

// Claude passes the terminal width in COLUMNS; one column stays free so the line never wraps.
const columns = Number.parseInt(process.env.COLUMNS ?? "", 10);
const width = columns > 1 ? columns - 1 : undefined;

process.stdout.write(`${render(toSnapshot(parseInput(readStdin()), environment), ansiPainter, width)}\n`);
