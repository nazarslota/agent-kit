import {basename} from "node:path";
import type {StatusSnapshot, TokenTotals} from "../core/types.js";

/** The parts of Pi's settings and extension context the status line reads. */
export interface PiCompactionSettings {
    readonly enabled?: boolean | undefined;
    readonly reserveTokens?: number | undefined;
    readonly modelOverrides?: Readonly<Record<string, {readonly reserveTokens?: number | undefined}>> | undefined;
}

export interface PiState {
    readonly cwd: string;
    readonly branch: string | undefined;
    readonly model: {readonly provider: string; readonly id: string; readonly contextWindow: number} | undefined;
    readonly thinkingLevel: string | undefined;
    readonly usage: {readonly tokens: number | null; readonly contextWindow: number} | undefined;
    readonly compaction: PiCompactionSettings | undefined;
    readonly tokens: TokenTotals | undefined;
}

/** Pi's default `compaction.reserveTokens`. */
export const DEFAULT_RESERVE_TOKENS = 16_384;

/** Pi compacts when context tokens exceed contextWindow - reserveTokens (exact, from Pi's docs). */
export function compactThreshold(
    window: number,
    model: PiState["model"],
    compaction: PiCompactionSettings | undefined,
): number | undefined {
    if (window <= 0 || compaction?.enabled === false) return undefined;
    const override = model ? compaction?.modelOverrides?.[`${model.provider}/${model.id}`]?.reserveTokens : undefined;
    return Math.max(0, window - (override ?? compaction?.reserveTokens ?? DEFAULT_RESERVE_TOKENS));
}

/** Pi's per-message usage, as recorded on assistant messages. */
export interface PiUsage {
    readonly input?: number | undefined;
    readonly output?: number | undefined;
    readonly cacheWrite?: number | undefined;
}

/** Session totals: new input (uncached input plus cache writes) and output. */
export function sumUsage(usages: Iterable<PiUsage | undefined>): TokenTotals {
    let input = 0;
    let output = 0;
    for (const usage of usages) {
        input += (usage?.input ?? 0) + (usage?.cacheWrite ?? 0);
        output += usage?.output ?? 0;
    }
    return {input, output};
}

export function toSnapshot(state: PiState): StatusSnapshot {
    const window = state.usage?.contextWindow ?? state.model?.contextWindow ?? 0;
    const thinking = state.thinkingLevel && state.thinkingLevel !== "off" ? state.thinkingLevel : undefined;

    return {
        label: undefined,
        repo: basename(state.cwd) || state.cwd,
        branch: state.branch,
        model: state.model?.id ?? "no model",
        reasoning: thinking,
        context: {
            used: state.usage?.tokens ?? undefined,
            window,
            compactAt: compactThreshold(window, state.model, state.compaction),
        },
        tokens: state.tokens,
    };
}
