import type {Painter, Role} from "../core/types.js";

const RESET = "\x1b[0m";

export type Theme = "dark" | "light";

/** Soft 256-color tones so the line doesn't shout; the bar only turns bright when it matters. */
const fg = (color: number) => `\x1b[38;5;${color}m`;

const palettes: Record<Theme, Record<Role, string>> = {
    dark: {
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
    },
    // Darker tones of the same hues: the dark palette fades out on a white background.
    light: {
        label: fg(130),
        repo: fg(24),
        branch: fg(28),
        model: fg(235),
        reasoning: fg(61),
        muted: fg(242),
        track: fg(250),
        normal: fg(31),
        warning: fg(136),
        error: fg(124),
    },
};

export function ansiPainter(theme: Theme): Painter {
    const codes = palettes[theme];
    return (segment) => (segment.role === undefined ? segment.text : `${codes[segment.role]}${segment.text}${RESET}`);
}
