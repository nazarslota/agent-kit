// Picks the palette for the terminal background. The status line has no terminal to ask, so it
// goes by, in order: AGENT_KIT_THEME, Claude's "theme" setting, then for "auto" the terminal's
// COLORFGBG and the system appearance.

import type {Theme} from "./ansi.js";

export interface ThemeHints {
    /** AGENT_KIT_THEME: "light" or "dark". */
    readonly override: string | undefined;
    /** Claude's theme setting, e.g. "dark", "light-daltonized" or "auto". */
    readonly setting: unknown;
    /** COLORFGBG, e.g. "15;0": foreground and background color indexes. */
    readonly colorFgBg: string | undefined;
    /** Whether the system is in dark mode; undefined when unknown. */
    readonly systemDark: () => boolean | undefined;
}

function fromName(name: unknown): Theme | undefined {
    if (typeof name !== "string") return undefined;
    if (name.startsWith("light")) return "light";
    if (name.startsWith("dark")) return "dark";
    return undefined;
}

/** Background index 7 (white) and 15 (bright white) are light; the other ANSI colors are dark. */
function fromColorFgBg(value: string | undefined): Theme | undefined {
    const background = Number.parseInt(value?.split(";").at(-1) ?? "", 10);
    if (!Number.isInteger(background)) return undefined;
    return background === 7 || background === 15 ? "light" : "dark";
}

export function resolveTheme(hints: ThemeHints): Theme {
    const system = () => {
        const dark = hints.systemDark();
        return dark === undefined ? undefined : dark ? "dark" : "light";
    };
    return fromName(hints.override) ?? fromName(hints.setting) ?? fromColorFgBg(hints.colorFgBg) ?? system() ?? "dark";
}
