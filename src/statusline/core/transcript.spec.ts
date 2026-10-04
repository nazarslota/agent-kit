import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {sumTranscript} from "./transcript.js";

function assistant(id: string, usage: Record<string, number>): string {
    return JSON.stringify({type: "assistant", uuid: `u-${id}-${Math.random()}`, message: {id, usage}});
}

describe("sumTranscript", () => {
    it("adds new input (uncached + cache writes) and output, ignoring cache reads", () => {
        const text = [
            JSON.stringify({type: "user", message: {content: "hi"}}),
            assistant("m1", {input_tokens: 10, cache_creation_input_tokens: 1_000, cache_read_input_tokens: 50_000, output_tokens: 200}),
            assistant("m2", {input_tokens: 5, cache_creation_input_tokens: 300, cache_read_input_tokens: 51_000, output_tokens: 80}),
        ].join("\n");
        assert.deepEqual(sumTranscript(text), {input: 1_315, output: 280});
    });

    it("counts a message split over several lines once", () => {
        const usage = {input_tokens: 10, cache_creation_input_tokens: 0, output_tokens: 100};
        assert.deepEqual(sumTranscript([assistant("m1", usage), assistant("m1", usage)].join("\n")), {input: 10, output: 100});
    });

    it("skips broken lines and records without usage", () => {
        const text = ["not json", '{"usage": 1', JSON.stringify({type: "assistant", message: {id: "m"}}), ""].join("\n");
        assert.deepEqual(sumTranscript(text), {input: 0, output: 0});
    });
});
