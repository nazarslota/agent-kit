/** How full the context is: drives the bar and percentage color. */
export type Level = "normal" | "warning" | "error";

export interface ContextUsage {
    /** Tokens currently in context; undefined when the agent can't tell yet (e.g. right after compaction). */
    readonly used: number | undefined;
    /** Model context window in tokens. */
    readonly window: number;
    /** Token count at which the agent compacts; undefined when compaction is off or unknown. */
    readonly compactAt: number | undefined;
}

/** Session token totals, as Pi's footer shows them (↑ input, ↓ output). */
export interface TokenTotals {
    /** New input tokens: uncached input plus cache writes. Cache reads are left out. */
    readonly input: number;
    readonly output: number;
}

/** Everything one status line shows, independent of which agent produced it. */
export interface StatusSnapshot {
    /** Free-form label shown in front of the line (e.g. a profile name); undefined hides it. */
    readonly label: string | undefined;
    readonly repo: string;
    readonly branch: string | undefined;
    readonly model: string;
    /** Reasoning/thinking label, e.g. "thinking" or "high"; undefined hides it. */
    readonly reasoning: string | undefined;
    readonly context: ContextUsage;
    /** Session totals; undefined hides them. */
    readonly tokens: TokenTotals | undefined;
}

/** Semantic style of a piece of text; each renderer maps roles to its own colors. */
export type Role = "label" | "repo" | "branch" | "model" | "reasoning" | "muted" | "track" | Level;

export interface Segment {
    readonly text: string;
    /** undefined renders as plain text. */
    readonly role: Role | undefined;
}

/** Turns a segment into terminal text for one renderer (ANSI codes, a Pi theme, or nothing). */
export type Painter = (segment: Segment) => string;
