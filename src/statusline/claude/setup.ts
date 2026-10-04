// Points Claude Code's statusLine setting at the agent-kit command, and takes it back out.

export const STATUS_LINE_COMMAND = "agent-kit statusline";

export type Settings = Record<string, unknown>;

export interface SetupResult {
    readonly settings: Settings;
    /** The command the setting ran before, when it was a different one. */
    readonly replaced: string | undefined;
}

/** Returns the settings with statusLine set to the agent-kit command; other keys are kept as they are. */
export function withStatusLine(settings: Settings, command: string = STATUS_LINE_COMMAND): SetupResult {
    const previous = statusLineCommand(settings);
    return {
        settings: {...settings, statusLine: {type: "command", command, padding: 0}},
        replaced: previous !== undefined && previous !== command ? previous : undefined,
    };
}

/** Removes statusLine when it runs the agent-kit command; a status line of someone else's stays. */
export function withoutStatusLine(settings: Settings, command: string = STATUS_LINE_COMMAND): Settings | undefined {
    if (statusLineCommand(settings) !== command) return undefined;
    const {statusLine: _removed, ...rest} = settings;
    return rest;
}

function statusLineCommand(settings: Settings): string | undefined {
    const current = settings.statusLine;
    return typeof current === "object" && current !== null && "command" in current && typeof current.command === "string"
        ? current.command
        : undefined;
}
