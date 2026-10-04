// Parses the JSON Claude Code pipes to a status line command. Every field is optional and
// validated: a newer or older Claude version must degrade to a shorter line, never a crash.

export interface ClaudeStatusInput {
    readonly cwd: string | undefined;
    readonly transcriptPath: string | undefined;
    readonly modelName: string | undefined;
    readonly thinking: boolean;
    readonly contextWindow: number | undefined;
    /** Tokens in context (input + cache creation + cache read); undefined before the first response. */
    readonly contextUsed: number | undefined;
}

type Json = Record<string, unknown>;

function object(value: unknown): Json | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : undefined;
}

function string(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function count(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function parseInput(raw: string): ClaudeStatusInput {
    let root: Json = {};
    try {
        root = object(JSON.parse(raw)) ?? {};
    } catch {
        // Fall through with an empty input.
    }

    const workspace = object(root.workspace);
    const model = object(root.model);
    const context = object(root.context_window);
    const usage = object(context?.current_usage);

    const usageParts = [usage?.input_tokens, usage?.cache_creation_input_tokens, usage?.cache_read_input_tokens].map(count);
    const contextUsed = usage ? usageParts.reduce<number>((sum, part) => sum + (part ?? 0), 0) : undefined;

    return {
        cwd: string(workspace?.current_dir) ?? string(root.cwd),
        transcriptPath: string(root.transcript_path),
        modelName: string(model?.display_name) ?? string(model?.id),
        thinking: object(root.thinking)?.enabled === true,
        contextWindow: count(context?.context_window_size),
        contextUsed,
    };
}
