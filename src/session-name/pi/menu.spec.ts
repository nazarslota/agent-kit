import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {DEFAULT_CONFIG} from "../core/config.js";
import {
    AUTO,
    applyChange,
    FALLBACK_MODEL,
    type MenuState,
    menuItems,
    modelOptions,
    modelValue,
    providerItemId,
    providers,
    RENAME_AFTER,
} from "./menu.js";

const state: MenuState = {
    config: {...DEFAULT_CONFIG, fallback: "anthropic/claude-haiku-5-5", models: {google: "google/gemini-flash"}},
    models: ["anthropic/claude-haiku-5-5", "openai-codex/gpt-6-luna", "anthropic/claude-opus-5-5"],
    currentProvider: "openai-codex",
    sessionName: "Fix login",
};

describe("menu items", () => {
    it("lists providers of available and configured models, the session's first", () => {
        assert.deepEqual(providers(state), ["openai-codex", "anthropic", "google"]);
    });

    it("shows the current values", () => {
        const items = new Map(menuItems(state).map((item) => [item.id, item.value]));
        assert.equal(items.get("rename"), "Fix login");
        assert.equal(items.get(AUTO), "on");
        assert.equal(items.get(RENAME_AFTER), "5");
        assert.equal(items.get(FALLBACK_MODEL), "anthropic/claude-haiku-5-5");
        assert.equal(items.get(providerItemId("google")), "google/gemini-flash");
        assert.equal(items.get(providerItemId("anthropic")), "anthropic/claude-haiku-5-5 (fallback)");
    });

    it("offers a custom turn count alongside the usual ones", () => {
        const item = menuItems({...state, config: {...state.config, renameAfterTurns: 7}}).find((i) => i.id === RENAME_AFTER);
        assert.deepEqual(item?.values, ["3", "5", "7", "10", "off"]);
        const off = menuItems({...state, config: {...state.config, renameAfterTurns: 0}}).find((i) => i.id === RENAME_AFTER);
        assert.equal(off?.value, "off");
    });

    it("lists the models a setting can take, unset first", () => {
        assert.deepEqual(
            modelOptions(state, "anthropic").map((o) => o.label),
            ["fallback", "anthropic/claude-haiku-5-5", "anthropic/claude-opus-5-5"],
        );
        assert.equal(modelOptions(state, undefined).length, 4);
        assert.equal(modelOptions(state, undefined)[0]?.label, "not set");
    });
});

describe("applyChange", () => {
    const config = state.config;

    it("toggles automatic naming and the second naming", () => {
        assert.equal(applyChange(config, AUTO, "off")?.auto, false);
        assert.equal(applyChange(config, RENAME_AFTER, "10")?.renameAfterTurns, 10);
        assert.equal(applyChange(config, RENAME_AFTER, "off")?.renameAfterTurns, 0);
    });

    it("sets and clears models", () => {
        assert.equal(applyChange(config, FALLBACK_MODEL, "openai-codex/gpt-6-luna")?.fallback, "openai-codex/gpt-6-luna");
        assert.equal(applyChange(config, FALLBACK_MODEL, "")?.fallback, undefined);
        assert.deepEqual(applyChange(config, providerItemId("anthropic"), "anthropic/claude-opus-5-5")?.models, {
            google: "google/gemini-flash",
            anthropic: "anthropic/claude-opus-5-5",
        });
        assert.deepEqual(applyChange(config, providerItemId("google"), "")?.models, {});
    });

    it("ignores rows that aren't settings", () => assert.equal(applyChange(config, "rename", "x"), undefined));

    it("shows the model that will be used", () => {
        assert.equal(modelValue(config, undefined), "anthropic/claude-haiku-5-5");
        assert.equal(modelValue(config, "anthropic"), "anthropic/claude-haiku-5-5 (fallback)");
        assert.equal(modelValue(config, "google"), "google/gemini-flash");
        assert.equal(modelValue(DEFAULT_CONFIG, undefined), "not set");
        assert.equal(modelValue(DEFAULT_CONFIG, "anthropic"), "not set");
    });
});
