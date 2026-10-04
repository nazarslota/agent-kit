#!/usr/bin/env node
// agent-kit command line: `agent-kit statusline` is the Claude Code status line command,
// `agent-kit setup claude` points Claude's settings at it and `agent-kit uninstall claude` undoes that.

import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join} from "node:path";
import {type Settings, withoutStatusLine, withStatusLine} from "./statusline/claude/setup.js";

const USAGE = `Usage:
  agent-kit setup claude       point Claude Code's statusLine at agent-kit
  agent-kit uninstall claude   remove it again
  agent-kit statusline         print the status line (Claude Code runs this)`;

function settingsFile(): string {
    return join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "settings.json");
}

/** The settings object, {} when the file is missing, or undefined when it isn't a JSON object. */
function readSettings(file: string): Settings | undefined {
    if (!existsSync(file)) return {};
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Settings) : undefined;
}

function writeSettings(file: string, settings: Settings): void {
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
}

function setupClaude(): number {
    const file = settingsFile();
    const settings = readSettings(file);
    if (!settings) {
        console.error(`${file} isn't a JSON object; left it unchanged.`);
        return 1;
    }
    const result = withStatusLine(settings);
    writeSettings(file, result.settings);
    if (result.replaced) console.log(`Replaced the previous status line: ${result.replaced}`);
    console.log(`Status line set in ${file}. Restart Claude Code to see it.`);
    return 0;
}

function uninstallClaude(): number {
    const file = settingsFile();
    const settings = readSettings(file);
    if (!settings) {
        console.error(`${file} isn't a JSON object; left it unchanged.`);
        return 1;
    }
    const updated = withoutStatusLine(settings);
    if (!updated) {
        console.log(`${file} doesn't use the agent-kit status line; nothing to remove.`);
        return 0;
    }
    writeSettings(file, updated);
    console.log(`Status line removed from ${file}. Now run: npm rm -g @nazarslota/agent-kit`);
    return 0;
}

const [command, target] = process.argv.slice(2);
if (command === "statusline") {
    await import("./statusline/claude/main.js");
} else if (command === "setup" && target === "claude") {
    process.exitCode = setupClaude();
} else if (command === "uninstall" && target === "claude") {
    process.exitCode = uninstallClaude();
} else {
    console.log(USAGE);
    process.exitCode = command === undefined || command === "help" || command === "--help" ? 0 : 1;
}
