import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {resolveTheme, type ThemeHints} from "./theme.js";

const none: ThemeHints = {override: undefined, setting: undefined, colorFgBg: undefined, systemDark: () => undefined};

describe("resolveTheme", () => {
    it("defaults to dark when nothing is known", () => {
        assert.equal(resolveTheme(none), "dark");
    });

    it("prefers AGENT_KIT_THEME, then Claude's setting", () => {
        assert.equal(resolveTheme({...none, override: "light", setting: "dark"}), "light");
        assert.equal(resolveTheme({...none, setting: "light-daltonized", systemDark: () => true}), "light");
        assert.equal(resolveTheme({...none, setting: "dark-ansi", systemDark: () => false}), "dark");
    });

    it("follows the terminal, then the system, for auto", () => {
        assert.equal(resolveTheme({...none, setting: "auto", colorFgBg: "0;15", systemDark: () => true}), "light");
        assert.equal(resolveTheme({...none, setting: "auto", colorFgBg: "15;0"}), "dark");
        assert.equal(resolveTheme({...none, setting: "auto", systemDark: () => false}), "light");
        assert.equal(resolveTheme({...none, setting: "auto", colorFgBg: "junk", systemDark: () => true}), "dark");
    });
});
