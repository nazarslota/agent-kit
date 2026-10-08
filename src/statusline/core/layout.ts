// The one place that decides what the status line looks like:
//   [label ·] ◆ repo · ⎇ branch │ Model · reasoning │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k ⇥546k

import {BAR_WIDTH, compactState, filledSegments, formatTokens, levelFor, percentUsed, usageLabel} from "./format.js";
import type {Painter, Segment, StatusSnapshot} from "./types.js";

const SEPARATOR: Segment = {text: " │ ", role: "muted"};
const DOT: Segment = {text: " · ", role: "muted"};

export function layout(snapshot: StatusSnapshot): Segment[] {
    const {context, tokens} = snapshot;
    const percent = percentUsed(context);
    const level = levelFor(percent);
    const filled = filledSegments(percent);
    const segments: Segment[] = [];

    if (snapshot.label) segments.push({text: snapshot.label, role: "label"}, DOT);

    segments.push({text: `◆ ${snapshot.repo}`, role: "repo"});
    if (snapshot.branch) segments.push(DOT, {text: `⎇ ${snapshot.branch}`, role: "branch"});

    segments.push(SEPARATOR, {text: snapshot.model, role: "model"});
    if (snapshot.reasoning) segments.push(DOT, {text: snapshot.reasoning, role: "reasoning"});

    segments.push(
        SEPARATOR,
        {text: "━".repeat(filled), role: level},
        {text: "─".repeat(BAR_WIDTH - filled), role: "track"},
        {text: ` ${usageLabel(context)}`, role: level},
    );

    if (tokens) segments.push(DOT, {text: `↑${formatTokens(tokens.input)} ↓${formatTokens(tokens.output)}`, role: "muted"});

    const compact = compactState(context);
    if (compact.kind === "left") segments.push({text: ` ⇥${formatTokens(compact.tokens)}`, role: "muted"});
    if (compact.kind === "soon") segments.push(DOT, {text: "compact soon", role: "error"});

    return segments.filter((segment) => segment.text.length > 0);
}

export function render(snapshot: StatusSnapshot, paint: Painter): string {
    return layout(snapshot).map(paint).join("");
}

/** Text without any styling; used by tests and as a fallback. */
export const plain: Painter = (segment) => segment.text;
