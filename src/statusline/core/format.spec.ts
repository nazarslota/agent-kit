import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {compactState, filledSegments, formatTokens, levelFor, percentUsed, shortModelName, usageLabel} from "./format.js";

describe("formatTokens", () => {
    it("formats each magnitude", () => {
        assert.equal(formatTokens(0), "0");
        assert.equal(formatTokens(404), "404");
        assert.equal(formatTokens(3_120), "3.1k");
        assert.equal(formatTokens(421_000), "421k");
        assert.equal(formatTokens(1_000_000), "1M");
        assert.equal(formatTokens(1_250_000), "1.2M");
    });

    it("treats invalid values as zero", () => {
        assert.equal(formatTokens(-5), "0");
        assert.equal(formatTokens(Number.NaN), "0");
    });
});

describe("percentUsed / levelFor / filledSegments", () => {
    it("computes and clamps the share", () => {
        assert.equal(percentUsed({used: 421_000, window: 1_000_000, compactAt: undefined}), 42.1);
        assert.equal(percentUsed({used: 2_000, window: 1_000, compactAt: undefined}), 100);
        assert.equal(percentUsed({used: undefined, window: 1_000, compactAt: undefined}), 0);
        assert.equal(percentUsed({used: 10, window: 0, compactAt: undefined}), 0);
    });

    it("switches level above 70 and 90 percent", () => {
        assert.equal(levelFor(70), "normal");
        assert.equal(levelFor(70.1), "warning");
        assert.equal(levelFor(90.1), "error");
    });

    it("rounds bar segments within bounds", () => {
        assert.equal(filledSegments(0), 0);
        assert.equal(filledSegments(42), 4);
        assert.equal(filledSegments(46), 5);
        assert.equal(filledSegments(150), 10);
    });
});

describe("usageLabel", () => {
    it("shows tokens when known, percent otherwise", () => {
        assert.equal(usageLabel({used: 421_000, window: 1_000_000, compactAt: undefined}), "421k/1M 42%");
        assert.equal(usageLabel({used: undefined, window: 200_000, compactAt: undefined}), "0% of 200k");
    });
});

describe("compactState", () => {
    it("counts down to the threshold, capped at the window", () => {
        assert.deepEqual(compactState({used: 421_000, window: 1_000_000, compactAt: 967_000}), {kind: "left", tokens: 546_000});
        assert.deepEqual(compactState({used: 100, window: 1_000, compactAt: 5_000}), {kind: "left", tokens: 900});
    });

    it("reports soon at or past the threshold", () => {
        assert.deepEqual(compactState({used: 967_000, window: 1_000_000, compactAt: 967_000}), {kind: "soon"});
    });

    it("is unknown without usage or threshold", () => {
        assert.deepEqual(compactState({used: undefined, window: 1_000, compactAt: 900}), {kind: "unknown"});
        assert.deepEqual(compactState({used: 10, window: 1_000, compactAt: undefined}), {kind: "unknown"});
    });
});

describe("shortModelName", () => {
    it("drops the context suffix only", () => {
        assert.equal(shortModelName("Opus 5.5 (1M context)"), "Opus 5.5");
        assert.equal(shortModelName("Haiku 4.5"), "Haiku 4.5");
    });
});
