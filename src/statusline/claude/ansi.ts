import type {Painter, Role} from "../core/types.js";

const RESET = "\x1b[0m";

const codes: Record<Role, string> = {
    label: "\x1b[33m",
    repo: "\x1b[1;36m",
    branch: "\x1b[32m",
    model: "\x1b[1m",
    muted: "\x1b[2m",
    track: "\x1b[2m",
    normal: "\x1b[36m",
    warning: "\x1b[33m",
    error: "\x1b[31m",
};

export const ansiPainter: Painter = (segment) =>
    segment.role === undefined ? segment.text : `${codes[segment.role]}${segment.text}${RESET}`;
