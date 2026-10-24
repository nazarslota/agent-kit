import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {AUTO_NAME_ENTRY, buildTranscript, cleanTitle, countTurns, lastAutoName, MAX_TITLE_LENGTH, shouldName} from "./title.js";

const user = (content: unknown) => ({type: "message", message: {role: "user", content}});
const assistant = (content: unknown) => ({type: "message", message: {role: "assistant", content}});

describe("buildTranscript", () => {
    it("keeps user and assistant text only", () => {
        const transcript = buildTranscript([
            user("Fix the login bug"),
            assistant([
                {type: "thinking", thinking: "hmm"},
                {type: "text", text: "Looking at auth.ts"},
                {type: "toolCall", name: "read"},
            ]),
            {type: "message", message: {role: "toolResult", content: [{type: "text", text: "file body"}]}},
            {type: "model_change"},
            user([{type: "text", text: "Thanks"}, {type: "image"}]),
        ]);
        assert.equal(transcript, "User: Fix the login bug\n\nAssistant: Looking at auth.ts\n\nUser: Thanks");
    });

    it("keeps the opening and the latest messages when over budget", () => {
        const entries = [user("first"), assistant("reply"), ...Array.from({length: 40}, (_, i) => user(`${i}`.repeat(1_000)))];
        const transcript = buildTranscript(entries);
        assert.ok(transcript.length <= 12_100);
        assert.ok(transcript.startsWith("User: first\n\nAssistant: reply\n\n[…]"));
        assert.ok(transcript.endsWith(`User: ${"39".repeat(750)}…`));
        assert.ok(!transcript.includes(`User: ${"0".repeat(1_000)}`));
    });

    it("is empty without text", () => assert.equal(buildTranscript([assistant([{type: "toolCall"}])]), ""));
});

describe("cleanTitle", () => {
    it("strips quotes, markdown, labels and the trailing period", () => {
        assert.equal(cleanTitle('"Fix login redirect bug."'), "Fix login redirect bug");
        assert.equal(cleanTitle("**Title:** Refactor auth"), "Refactor auth");
        assert.equal(cleanTitle("Title: Refactor auth"), "Refactor auth");
        assert.equal(cleanTitle("# Плагін   для назв сесій"), "Плагін для назв сесій");
        assert.equal(cleanTitle("«Назва сесії»"), "Назва сесії");
    });

    it("takes the first non-empty line", () => assert.equal(cleanTitle("\n\nSession naming plugin\nExtra"), "Session naming plugin"));

    it("caps the length", () => {
        const title = cleanTitle("word ".repeat(40));
        assert.ok(title && title.length <= MAX_TITLE_LENGTH && title.endsWith("…"));
    });

    it("returns undefined for nothing usable", () => {
        assert.equal(cleanTitle("  \n "), undefined);
        assert.equal(cleanTitle('""'), undefined);
    });
});

describe("countTurns and lastAutoName", () => {
    const entries = [
        user("a"),
        {type: "custom", customType: AUTO_NAME_ENTRY, data: {name: "First", turns: 1}},
        assistant("b"),
        user("c"),
        {type: "custom", customType: "other", data: {name: "Nope", turns: 9}},
        {type: "custom", customType: AUTO_NAME_ENTRY, data: {name: "Second", turns: 5}},
    ];
    it("counts user prompts", () => assert.equal(countTurns(entries), 2));
    it("finds the latest auto name", () => assert.deepEqual(lastAutoName(entries), {name: "Second", turns: 5}));
    it("is undefined without one", () => assert.equal(lastAutoName([user("a")]), undefined));
});

describe("shouldName", () => {
    const base = {currentName: undefined, lastAuto: undefined, turns: 1, renameAfterTurns: 5};

    it("names an unnamed session after the first turn", () => assert.equal(shouldName(base), true));
    it("waits for a turn", () => assert.equal(shouldName({...base, turns: 0}), false));
    it("leaves a name the user gave", () => assert.equal(shouldName({...base, currentName: "Mine", turns: 5}), false));
    it("leaves a name the user changed", () => {
        assert.equal(shouldName({...base, currentName: "Mine", lastAuto: {name: "Auto", turns: 1}, turns: 5}), false);
    });

    it("renames its own name once the turn count is reached", () => {
        const own = {...base, currentName: "Auto", lastAuto: {name: "Auto", turns: 1}};
        assert.equal(shouldName({...own, turns: 4}), false);
        assert.equal(shouldName({...own, turns: 5}), true);
        assert.equal(shouldName({...own, turns: 7}), true);
        assert.equal(shouldName({...own, lastAuto: {name: "Auto", turns: 5}, turns: 7}), false);
    });

    it("never renames with renaming off", () => {
        assert.equal(shouldName({...base, currentName: "Auto", lastAuto: {name: "Auto", turns: 1}, turns: 5, renameAfterTurns: 0}), false);
    });
});
