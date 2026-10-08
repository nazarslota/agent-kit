import type {Painter, Role} from "../core/types.js";

const RESET = "\x1b[0m";

/** Soft 256-color tones so the line doesn't shout; the bar only turns bright when it matters. */
const fg = (color: number) => `\x1b[38;5;${color}m`;

const codes: Record<Role, string> = {
    label: fg(180),
    repo: fg(110),
    branch: fg(108),
    model: fg(252),
    reasoning: fg(146),
    muted: fg(243),
    track: fg(238),
    normal: fg(67),
    warning: fg(179),
    error: fg(167),
};

export const ansiPainter: Painter = (segment) =>
    segment.role === undefined ? segment.text : `${codes[segment.role]}${segment.text}${RESET}`;
