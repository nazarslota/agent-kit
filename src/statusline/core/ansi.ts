import type {Painter, Role} from "../core/types.js";

const RESET = "\x1b[0m";

// The terminal's own 16-color palette, so the line takes the colors of whatever theme the terminal
// runs, light or dark. As in the Pure prompt, only the repo is colored and the rest stays grey;
// color comes back only when the context fills up.
const codes: Record<Role, string> = {
    label: "\x1b[34m",
    repo: "\x1b[1;34m",
    branch: "\x1b[90m",
    model: "\x1b[39m",
    reasoning: "\x1b[90m",
    muted: "\x1b[90m",
    track: "\x1b[2;90m",
    normal: "\x1b[90m",
    warning: "\x1b[33m",
    error: "\x1b[31m",
};

export const ansiPainter: Painter = (segment) =>
    segment.role === undefined ? segment.text : `${codes[segment.role]}${segment.text}${RESET}`;
