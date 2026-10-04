// Sums session token totals from a Claude Code transcript (JSONL). Pure: callers read the file,
// with Node in the status line command and with `$.fs` in the plugin.
//
// One API response can appear on several lines (one per content block), so lines are counted
// once per message id.

import type {TokenTotals} from "./types.js";

type Json = Record<string, unknown>;

function count(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function sumTranscript(text: string): TokenTotals {
    const seen = new Set<string>();
    let input = 0;
    let output = 0;

    for (const line of text.split("\n")) {
        if (!line.includes('"usage"')) continue;
        let record: Json;
        try {
            record = JSON.parse(line) as Json;
        } catch {
            continue;
        }
        if (record.type !== "assistant") continue;
        const message = record.message as Json | undefined;
        const usage = message?.usage as Json | undefined;
        if (!usage) continue;

        const id = typeof message?.id === "string" ? message.id : String(record.uuid ?? seen.size);
        if (seen.has(id)) continue;
        seen.add(id);

        input += count(usage.input_tokens) + count(usage.cache_creation_input_tokens);
        output += count(usage.output_tokens);
    }

    return {input, output};
}
