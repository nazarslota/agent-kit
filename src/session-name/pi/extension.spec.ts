// Loads the extension against a fake Pi API and model registry.

import assert from "node:assert/strict";
import {mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";
import {type ExtensionAPI, initTheme} from "@earendil-works/pi-coding-agent";
import {AUTO_NAME_ENTRY} from "../core/title.js";
import {register} from "./extension.js";

type Handler = (event: unknown, ctx: unknown) => unknown;
interface MenuComponent {
    render(width: number): string[];
    handleInput(data: string): void;
}
interface Command {
    handler(args: string, ctx: unknown): Promise<void>;
    getArgumentCompletions(prefix: string): unknown;
}

const haiku = {provider: "anthropic", id: "claude-haiku-5-5"};
const opus = {provider: "anthropic", id: "claude-opus-5-5"};
const luna = {provider: "openai-codex", id: "gpt-luna"};

interface Setup {
    readonly config?: unknown;
    readonly reply?: string | Error;
    readonly entries?: unknown[];
    readonly name?: string;
    readonly available?: Array<{provider: string; id: string}>;
    readonly selections?: string[];
    readonly mode?: string;
    /** Keys pressed in the terminal menu, in order. */
    readonly keys?: readonly string[];
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: matches the ANSI escape character on purpose.
const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

const DOWN = "\x1b[B";
const UP = "\x1b[A";
const ENTER = "\r";
const ESC = "\x1b";

// Pi initializes its theme before any extension command runs; the list themes need it.
initTheme("dark", false);

/** Enough of Pi's theme for the menu to draw. */
const theme = {fg: (_color: string, text: string) => text, bold: (text: string) => text};

async function setup(options: Setup = {}) {
    const dir = await mkdtemp(join(tmpdir(), "agent-kit-"));
    const path = join(dir, "settings.json");
    if (options.config !== undefined) await writeFile(path, JSON.stringify({theme: "dark", agentKit: options.config}));

    const handlers = new Map<string, Handler>();
    const commands = new Map<string, Command>();
    const entries: unknown[] = [...(options.entries ?? [])];
    let name = options.name;
    const pi = {
        on: (event: string, handler: Handler) => handlers.set(event, handler),
        registerCommand: (n: string, command: Command) => commands.set(n, command),
        getSessionName: () => name,
        setSessionName: (n: string) => {
            name = n;
        },
        appendEntry: (customType: string, data: unknown) => entries.push({type: "custom", customType, data}),
    };
    register(pi as unknown as ExtensionAPI, {configPath: () => path});

    const notes: Array<{message: string; type: string | undefined}> = [];
    const selects: Array<{title: string; options: string[]}> = [];
    const selections = [...(options.selections ?? [])];
    const requests: unknown[] = [];
    const available = options.available ?? [haiku, opus, luna];
    const frames: string[] = [];
    const ctx = {
        hasUI: true,
        mode: options.mode ?? "rpc",
        model: opus,
        sessionManager: {getSessionId: () => "s1", getEntries: () => entries, getBranch: () => entries},
        modelRegistry: {
            find: (provider: string, id: string) => available.find((m) => m.provider === provider && m.id === id),
            hasConfiguredAuth: () => true,
            getAvailable: () => available,
            streamSimple: (model: unknown, context: unknown, opts: unknown) => {
                requests.push({model, context, opts});
                return {
                    result: async () => {
                        const reply = options.reply ?? "Session naming plugin";
                        if (reply instanceof Error) return {stopReason: "error", errorMessage: reply.message, content: []};
                        return {stopReason: "stop", content: [{type: "text", text: reply}]};
                    },
                };
            },
        },
        ui: {
            notify: (message: string, type?: string) => notes.push({message, type}),
            setStatus: () => {},
            custom: async (factory: (tui: unknown, theme: unknown, kb: unknown, done: (r: unknown) => void) => MenuComponent) => {
                let result: unknown;
                let closed = false;
                const component = factory({requestRender: () => {}}, theme, {}, (r) => {
                    result = r;
                    closed = true;
                });
                for (const key of options.keys ?? []) {
                    if (closed) break;
                    component.handleInput(key);
                    frames.push(stripAnsi(component.render(100).join("\n")));
                }
                assert.ok(closed, "the keys close the menu");
                return result;
            },
            select: async (title: string, opts: string[]) => {
                selects.push({title, options: opts});
                const want = selections.shift();
                return want === undefined ? undefined : opts.find((o) => o.startsWith(want));
            },
        },
    };
    await handlers.get("session_start")?.({reason: "startup"}, ctx);

    /** Fires agent_end and waits for the background naming to finish. */
    const endTurn = async () => {
        await handlers.get("agent_end")?.({messages: []}, ctx);
        await new Promise((resolve) => setTimeout(resolve, 20));
    };
    const command = commands.get("autoname") as Command;
    const config = async () => JSON.parse(await readFile(path, "utf8")).agentKit.sessionName;
    return {ctx, entries, notes, selects, requests, frames, endTurn, command, config, path, name: () => name};
}

const user = (text: string) => ({type: "message", message: {role: "user", content: text}});
const assistant = (text: string) => ({type: "message", message: {role: "assistant", content: [{type: "text", text}]}});
const withFallback = {sessionName: {fallback: "anthropic/claude-haiku-5-5"}};

describe("session name extension", () => {
    it("names an unnamed session after the first turn with the configured model", async () => {
        const t = await setup({config: withFallback, entries: [user("Чи можемо розробити плагін?"), assistant("Так")]});
        await t.endTurn();
        assert.equal(t.name(), "Session naming plugin");
        assert.equal(t.requests.length, 1);
        const request = t.requests[0] as {model: unknown; context: {messages: Array<{content: Array<{text: string}>}>}};
        assert.deepEqual(request.model, haiku);
        assert.match(request.context.messages[0]?.content[0]?.text ?? "", /Чи можемо розробити плагін/);
        assert.deepEqual(t.entries.at(-1), {type: "custom", customType: AUTO_NAME_ENTRY, data: {name: "Session naming plugin", turns: 1}});
    });

    it("uses the provider's own model over the fallback", async () => {
        const t = await setup({
            config: {sessionName: {fallback: "anthropic/claude-haiku-5-5", models: {anthropic: "anthropic/claude-opus-5-5"}}},
            entries: [user("hi")],
        });
        await t.endTurn();
        assert.deepEqual((t.requests[0] as {model: unknown}).model, opus);
    });

    it("reports a missing model once per session", async () => {
        const t = await setup({entries: [user("hi")]});
        await t.endTurn();
        await t.endTurn();
        assert.equal(t.name(), undefined);
        assert.equal(t.notes.length, 1);
        assert.equal(t.notes[0]?.type, "error");
        assert.match(t.notes[0]?.message ?? "", /no model set for anthropic.*Run \/autoname to choose/);
    });

    it("reports a configured model that doesn't exist", async () => {
        const t = await setup({config: {sessionName: {fallback: "anthropic/claude-nope"}}, entries: [user("hi")]});
        await t.endTurn();
        assert.match(t.notes[0]?.message ?? "", /anthropic\/claude-nope not found/);
    });

    it("reports a failed request", async () => {
        const t = await setup({config: withFallback, reply: new Error("rate limited"), entries: [user("hi")]});
        await t.endTurn();
        assert.match(t.notes[0]?.message ?? "", /rate limited/);
        assert.equal(t.name(), undefined);
    });

    it("leaves a name the user gave", async () => {
        const t = await setup({config: withFallback, name: "My session", entries: [user("hi")]});
        await t.endTurn();
        assert.equal(t.requests.length, 0);
        assert.equal(t.name(), "My session");
    });

    it("renames its own name at the configured turn", async () => {
        const turns = (n: number) => Array.from({length: n}, (_, i) => user(`prompt ${i}`));
        const t = await setup({
            config: withFallback,
            name: "Early name",
            reply: "Better name",
            entries: [...turns(4), {type: "custom", customType: AUTO_NAME_ENTRY, data: {name: "Early name", turns: 1}}],
        });
        await t.endTurn();
        assert.equal(t.requests.length, 0, "turn 4 is too early");
        t.entries.push(user("prompt 5"));
        await t.endTurn();
        assert.equal(t.name(), "Better name");
        t.entries.push(user("prompt 6"));
        await t.endTurn();
        assert.equal(t.requests.length, 1, "renames only once");
    });

    it("does nothing with auto naming off", async () => {
        const t = await setup({config: {sessionName: {...withFallback.sessionName, auto: false}}, entries: [user("hi")]});
        await t.endTurn();
        assert.equal(t.requests.length, 0);
        assert.equal(t.notes.length, 0);
    });

    it("/autoname now renames, even over the user's name", async () => {
        const t = await setup({config: withFallback, name: "Mine", entries: [user("hi")], reply: "Fresh"});
        await t.command.handler("now", t.ctx);
        assert.equal(t.name(), "Fresh");
        assert.deepEqual(t.notes.at(-1), {message: "Session name: Fresh", type: "info"});
    });

    it("/autoname opens the terminal menu and saves what changes in it", async () => {
        // Down to "Name sessions automatically", Enter turns it off, Esc closes.
        const t = await setup({config: withFallback, mode: "tui", keys: [DOWN, ENTER, ESC]});
        await t.command.handler("", t.ctx);
        assert.equal((await t.config()).auto, false);
        assert.ok(t.frames.some((frame) => frame.includes("Session names")));
        assert.equal(t.requests.length, 0);
    });

    it("/autoname menu picks a model from the searchable list", async () => {
        // Down to "Fallback model", open it, filter to "luna", pick it.
        const t = await setup({mode: "tui", keys: [DOWN, DOWN, DOWN, ENTER, ..."luna", ENTER, ESC]});
        await t.command.handler("", t.ctx);
        assert.equal((await t.config()).fallback, "openai-codex/gpt-luna");
    });

    it("/autoname menu clears a model without saving the label", async () => {
        // Fallback model, open, Enter on the first row ("not set"), close.
        const t = await setup({config: withFallback, mode: "tui", keys: [DOWN, DOWN, DOWN, ENTER, UP, ENTER, ESC]});
        await t.command.handler("", t.ctx);
        assert.equal((await t.config()).fallback, undefined);
        const last = t.frames.at(-2) ?? "";
        assert.match(last, /Fallback model\s+not set/);
        assert.match(last, /Model for anthropic\s+not set/);
    });

    it("/autoname menu shows the fallback model on provider rows and follows it", async () => {
        // Fallback model → claude-opus; the anthropic row follows.
        const t = await setup({config: withFallback, mode: "tui", keys: [DOWN, DOWN, DOWN, ENTER, ..."opus", ENTER, ESC]});
        await t.command.handler("", t.ctx);
        assert.match(t.frames[0] ?? "", /Model for anthropic\s+anthropic\/claude-haiku-5-5 \(fallback\)/);
        assert.match(t.frames.at(-2) ?? "", /Model for anthropic\s+anthropic\/claude-opus-5-5 \(fallback\)/);
        assert.equal((await t.config()).fallback, "anthropic/claude-opus-5-5");
    });

    it("/autoname menu renames the session from its first row", async () => {
        const t = await setup({config: withFallback, mode: "tui", entries: [user("hi")], keys: [ENTER], reply: "From menu"});
        await t.command.handler("", t.ctx);
        assert.equal(t.name(), "From menu");
    });

    it("/autoname falls back to selects outside the terminal", async () => {
        const t = await setup({selections: ["Fallback model", "anthropic/claude-haiku-5-5"]});
        await t.command.handler("", t.ctx);
        assert.equal((await t.config()).fallback, "anthropic/claude-haiku-5-5");
        const rows = t.selects[0]?.options ?? [];
        assert.match(rows[0] ?? "", /^Rename this session now/);
        assert.match(rows[4] ?? "", /^Model for anthropic/, "the session's provider comes first");
        assert.deepEqual(t.selects[1]?.options, [
            "not set",
            "anthropic/claude-haiku-5-5",
            "anthropic/claude-opus-5-5",
            "openai-codex/gpt-luna",
        ]);

        const u = await setup({config: withFallback, selections: ["Model for openai-codex", "openai-codex/gpt-luna"]});
        await u.command.handler("", u.ctx);
        assert.deepEqual(await u.config(), {
            fallback: "anthropic/claude-haiku-5-5",
            models: {"openai-codex": "openai-codex/gpt-luna"},
            auto: true,
            renameAfterTurns: 5,
        });
        assert.deepEqual(u.selects[1]?.options, ["fallback", "openai-codex/gpt-luna"]);
        assert.match(u.selects[0]?.options[5] ?? "", /Model for openai-codex {2}· {2}anthropic\/claude-haiku-5-5 \(fallback\)/);
        assert.equal(JSON.parse(await readFile(u.path, "utf8")).theme, "dark", "keeps Pi's own settings");

        const v = await setup({
            config: {sessionName: {models: {anthropic: "anthropic/claude-haiku-5-5"}}},
            selections: ["Model for anthropic", "fallback"],
        });
        await v.command.handler("", v.ctx);
        assert.deepEqual((await v.config()).models, {});

        const w = await setup({selections: ["Rename again after turn", "off"]});
        await w.command.handler("", w.ctx);
        assert.equal((await w.config()).renameAfterTurns, 0);
    });

    it("completes subcommands and rejects unknown ones", async () => {
        const t = await setup();
        assert.deepEqual(
            (t.command.getArgumentCompletions("n") as Array<{value: string}>).map((i) => i.value),
            ["now"],
        );
        assert.equal(t.command.getArgumentCompletions("x"), null);
        await t.command.handler("bogus", t.ctx);
        assert.match(t.notes[0]?.message ?? "", /unknown subcommand/);
    });
});
