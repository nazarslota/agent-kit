import assert from "node:assert/strict";
import {lstat, mkdir, mkdtemp, readFile, rmdir, stat, symlink, utimes, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";
import {DEFAULT_CONFIG, loadConfig, modelRefFor, parseConfig, parseModelRef, saveConfig} from "./config.js";

describe("parseConfig", () => {
    it("falls back to defaults without a section", () => {
        assert.deepEqual(parseConfig({}), DEFAULT_CONFIG);
        assert.deepEqual(parseConfig(null), DEFAULT_CONFIG);
        assert.deepEqual(parseConfig({agentKit: {sessionName: "nope"}}), DEFAULT_CONFIG);
    });

    it("reads every field and drops malformed ones", () => {
        const config = parseConfig({
            agentKit: {
                sessionName: {
                    fallback: " anthropic/claude-haiku-5-5 ",
                    models: {"openai-codex": "openai-codex/gpt-luna", broken: 3, empty: " "},
                    auto: false,
                    renameAfterTurns: 8,
                },
            },
        });
        assert.deepEqual(config, {
            fallback: "anthropic/claude-haiku-5-5",
            models: {"openai-codex": "openai-codex/gpt-luna"},
            auto: false,
            renameAfterTurns: 8,
        });
    });

    it("accepts 0 to turn renaming off but rejects negative or fractional turns", () => {
        assert.equal(parseConfig({agentKit: {sessionName: {renameAfterTurns: 0}}}).renameAfterTurns, 0);
        assert.equal(parseConfig({agentKit: {sessionName: {renameAfterTurns: -1}}}).renameAfterTurns, 5);
        assert.equal(parseConfig({agentKit: {sessionName: {renameAfterTurns: 2.5}}}).renameAfterTurns, 5);
    });
});

describe("modelRefFor", () => {
    const config = {...DEFAULT_CONFIG, fallback: "anthropic/claude-haiku-5-5", models: {"openai-codex": "openai-codex/gpt-luna"}};

    it("prefers the provider's own model", () => assert.equal(modelRefFor(config, "openai-codex"), "openai-codex/gpt-luna"));
    it("falls back to the fallback model", () => assert.equal(modelRefFor(config, "google"), "anthropic/claude-haiku-5-5"));
    it("is undefined when nothing is set", () => assert.equal(modelRefFor(DEFAULT_CONFIG, "anthropic"), undefined));
});

describe("parseModelRef", () => {
    it("splits at the first slash", () => {
        assert.deepEqual(parseModelRef("openrouter/meta/llama-4"), {provider: "openrouter", id: "meta/llama-4"});
    });
    it("rejects refs without both parts", () => {
        assert.equal(parseModelRef("haiku"), undefined);
        assert.equal(parseModelRef("/haiku"), undefined);
        assert.equal(parseModelRef("anthropic/"), undefined);
    });
});

describe("saveConfig", () => {
    it("writes the section and keeps other keys", async () => {
        const dir = await mkdtemp(join(tmpdir(), "agent-kit-"));
        const path = join(dir, "nested", "settings.json");
        await saveConfig(path, {...DEFAULT_CONFIG, fallback: "anthropic/claude-haiku-5-5"});

        const file = JSON.parse(await readFile(path, "utf8"));
        file.other = {keep: true};
        await writeFile(path, JSON.stringify(file));

        await saveConfig(path, {...DEFAULT_CONFIG, models: {anthropic: "anthropic/claude-haiku-5-5"}});
        const saved = JSON.parse(await readFile(path, "utf8"));
        assert.deepEqual(saved.other, {keep: true});
        assert.equal(saved.agentKit.sessionName.fallback, undefined);
        assert.deepEqual(await loadConfig(path), {...DEFAULT_CONFIG, models: {anthropic: "anthropic/claude-haiku-5-5"}});
    });

    it("keeps other agentKit keys and reads a file with a BOM", async () => {
        const dir = await mkdtemp(join(tmpdir(), "agent-kit-"));
        const path = join(dir, "settings.json");
        await writeFile(path, `\uFEFF${JSON.stringify({agentKit: {future: 1}})}`);
        await saveConfig(path, {...DEFAULT_CONFIG, auto: false});
        const saved = JSON.parse(await readFile(path, "utf8"));
        assert.equal(saved.agentKit.future, 1);
        assert.equal((await loadConfig(path)).auto, false);
    });

    it("waits for Pi's lock and releases its own", async () => {
        const dir = await mkdtemp(join(tmpdir(), "agent-kit-"));
        const path = join(dir, "settings.json");
        await mkdir(`${path}.lock`);
        const saving = saveConfig(path, DEFAULT_CONFIG);
        await new Promise((resolve) => setTimeout(resolve, 60));
        await assert.rejects(stat(path), "doesn't write while locked");
        await rmdir(`${path}.lock`);
        await saving;
        assert.deepEqual(await loadConfig(path), DEFAULT_CONFIG);
        await assert.rejects(stat(`${path}.lock`), "lock removed");
    });

    it("keeps a symlinked settings file a symlink", async () => {
        const dir = await mkdtemp(join(tmpdir(), "agent-kit-"));
        const target = join(dir, "dotfiles-settings.json");
        const link = join(dir, "settings.json");
        await writeFile(target, JSON.stringify({theme: "dark"}));
        await symlink(target, link);
        await saveConfig(link, {...DEFAULT_CONFIG, auto: false});
        assert.ok((await lstat(link)).isSymbolicLink());
        assert.equal(JSON.parse(await readFile(target, "utf8")).agentKit.sessionName.auto, false);
    });

    it("takes over a stale lock", async () => {
        const dir = await mkdtemp(join(tmpdir(), "agent-kit-"));
        const path = join(dir, "settings.json");
        await mkdir(`${path}.lock`);
        const old = new Date(Date.now() - 60_000);
        await utimes(`${path}.lock`, old, old);
        await saveConfig(path, DEFAULT_CONFIG);
        assert.deepEqual(await loadConfig(path), DEFAULT_CONFIG);
    });

    it("reads a missing file as defaults and reports broken JSON", async () => {
        const dir = await mkdtemp(join(tmpdir(), "agent-kit-"));
        assert.deepEqual(await loadConfig(join(dir, "missing.json")), DEFAULT_CONFIG);
        const broken = join(dir, "broken.json");
        await writeFile(broken, "{");
        await assert.rejects(loadConfig(broken), /Can't read/);
    });
});
