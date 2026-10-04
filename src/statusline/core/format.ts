import type {ContextUsage, Level} from "./types.js";

export const BAR_WIDTH = 10;

const WARNING_PERCENT = 70;
const ERROR_PERCENT = 90;

/** 404 → "404", 3 120 → "3.1k", 421 000 → "421k", 1 000 000 → "1M". */
export function formatTokens(value: number): string {
    if (!Number.isFinite(value) || value < 0) return "0";
    if (value < 1_000) return String(Math.round(value));
    if (value < 10_000) return `${Math.floor(value / 100) / 10}k`;
    if (value < 1_000_000) return `${Math.round(value / 1_000)}k`;
    return `${Math.floor(value / 100_000) / 10}M`;
}

/** Share of the window in use, clamped to 0–100; 0 when unknown. */
export function percentUsed(context: ContextUsage): number {
    if (context.used === undefined || context.window <= 0) return 0;
    return Math.max(0, Math.min(100, (context.used / context.window) * 100));
}

export function levelFor(percent: number): Level {
    if (percent > ERROR_PERCENT) return "error";
    if (percent > WARNING_PERCENT) return "warning";
    return "normal";
}

/** Number of filled bar segments out of BAR_WIDTH. */
export function filledSegments(percent: number): number {
    return Math.min(BAR_WIDTH, Math.max(0, Math.round((percent / 100) * BAR_WIDTH)));
}

/** "421k/1M 42%", or "42% of 1M" when the token count isn't known. */
export function usageLabel(context: ContextUsage): string {
    const percent = Math.floor(percentUsed(context));
    if (context.used === undefined) return `${percent}% of ${formatTokens(context.window)}`;
    return `${formatTokens(context.used)}/${formatTokens(context.window)} ${percent}%`;
}

export type CompactState = {readonly kind: "unknown"} | {readonly kind: "left"; readonly tokens: number} | {readonly kind: "soon"};

/** Room left before the agent compacts. */
export function compactState(context: ContextUsage): CompactState {
    if (context.used === undefined || context.compactAt === undefined || context.window <= 0) return {kind: "unknown"};
    const left = Math.min(context.window, context.compactAt) - context.used;
    return left > 0 ? {kind: "left", tokens: left} : {kind: "soon"};
}

/** Drops a trailing "(1M context)"-style suffix; the window is shown separately. */
export function shortModelName(name: string): string {
    return name.replace(/\s*\([^)]*context\)$/i, "").trim();
}

/**
 * Turns a Claude model id into its display name: "claude-opus-5-5" → "Opus 5.5",
 * "claude-haiku-4-5-20251001" → "Haiku 4.5". Other ids are returned unchanged.
 */
export function modelLabel(id: string): string {
    const match = /^claude-([a-z]+)-(\d{1,2}(?:-\d{1,2})*)(?:-\d{8})?(?:\[[^\]]*])?$/.exec(id);
    if (!match?.[1] || !match[2]) return id;
    const family = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return `${family} ${match[2].replaceAll("-", ".")}`;
}
