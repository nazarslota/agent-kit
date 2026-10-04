// Estimates where Claude Code auto-compacts. Claude doesn't pass its threshold to the status line,
// so this mirrors what `/context` reports: compaction fires at the auto-compact window minus a
// summary buffer (33k on a 1M window, i.e. 3.3%).
//
// The window comes from CLAUDE_CODE_AUTO_COMPACT_WINDOW, else `autoCompactWindow` in settings
// (set with /autocompact), else the model's context window. AGENT_KIT_CLAUDE_COMPACT_BUFFER
// overrides the buffer in tokens if Claude changes it.

export const DEFAULT_BUFFER_FRACTION = 0.033;

export interface CompactionSources {
    /** CLAUDE_CODE_AUTO_COMPACT_WINDOW */
    readonly envWindow: string | undefined;
    /** autoCompactWindow from settings.json */
    readonly settingsWindow: unknown;
    /** AGENT_KIT_CLAUDE_COMPACT_BUFFER */
    readonly envBuffer: string | undefined;
}

function positive(value: unknown): number | undefined {
    const number = typeof value === "string" ? Number(value) : value;
    return typeof number === "number" && Number.isFinite(number) && number > 0 ? number : undefined;
}

export function compactThreshold(contextWindow: number | undefined, sources: CompactionSources): number | undefined {
    if (contextWindow === undefined || contextWindow <= 0) return undefined;
    const configured = positive(sources.envWindow) ?? positive(sources.settingsWindow);
    const window = Math.min(contextWindow, configured ?? contextWindow);
    const buffer = positive(sources.envBuffer) ?? Math.round(window * DEFAULT_BUFFER_FRACTION);
    return Math.max(0, window - buffer);
}
