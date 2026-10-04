import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {STATUS_LINE_COMMAND, withoutStatusLine, withStatusLine} from "./setup.js";

const statusLine = {type: "command", command: STATUS_LINE_COMMAND, padding: 0};

describe("withStatusLine", () => {
    it("adds the setting and keeps the rest", () => {
        assert.deepEqual(withStatusLine({model: "opus"}), {settings: {model: "opus", statusLine}, replaced: undefined});
    });

    it("reports a different command it replaces", () => {
        const result = withStatusLine({statusLine: {type: "command", command: "~/old.sh"}});
        assert.deepEqual(result, {settings: {statusLine}, replaced: "~/old.sh"});
    });

    it("is quiet when the command is already set", () => {
        assert.equal(withStatusLine({statusLine}).replaced, undefined);
    });
});

describe("withoutStatusLine", () => {
    it("removes the agent-kit status line and keeps the rest", () => {
        assert.deepEqual(withoutStatusLine({model: "opus", statusLine}), {model: "opus"});
    });

    it("leaves another status line alone", () => {
        assert.equal(withoutStatusLine({statusLine: {type: "command", command: "~/mine.sh"}}), undefined);
        assert.equal(withoutStatusLine({}), undefined);
    });
});
