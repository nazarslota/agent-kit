// What to send the naming model, how to read its reply, and when a session needs a name.

export const SYSTEM_PROMPT = [
    "You name sessions between a user and a coding agent.",
    "Read the conversation and reply with a title of 3 to 7 words that says what the session is about: the task or the topic, not the tools used.",
    "Write the title in the language the user writes in.",
    "Plain text only: no quotes, no markdown, no emoji, no trailing period.",
    "Reply with the title and nothing else. Do not answer or continue the conversation.",
].join("\n");

export const MAX_TITLE_LENGTH = 80;

/** Per-message and total character budgets for the transcript sent to the naming model. */
const MESSAGE_CHARS = 1_500;
const TOTAL_CHARS = 12_000;

interface Block {
    type?: string;
    text?: string;
}

interface Entry {
    type?: string;
    customType?: string;
    data?: unknown;
    message?: {role?: string; content?: unknown};
}

function textOf(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return (content as Block[])
        .filter((block) => block?.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n");
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** Number of user prompts on the branch. */
export function countTurns(entries: readonly unknown[]): number {
    return (entries as readonly Entry[]).filter((e) => e.type === "message" && e.message?.role === "user").length;
}

/**
 * User and assistant text from the branch, without thinking, tool calls or tool output.
 * Over budget, it keeps the opening exchange and as many of the latest messages as fit.
 */
export function buildTranscript(entries: readonly unknown[]): string {
    const parts: string[] = [];
    for (const entry of entries as readonly Entry[]) {
        const role = entry.type === "message" ? entry.message?.role : undefined;
        if (role !== "user" && role !== "assistant") continue;
        const text = textOf(entry.message?.content).trim();
        if (text) parts.push(`${role === "user" ? "User" : "Assistant"}: ${clip(text, MESSAGE_CHARS)}`);
    }

    const total = (list: readonly string[]) => list.reduce((sum, part) => sum + part.length + 2, 0);
    if (total(parts) <= TOTAL_CHARS) return parts.join("\n\n");

    const head = parts.slice(0, 2);
    const tail: string[] = [];
    let budget = TOTAL_CHARS - total(head);
    for (let i = parts.length - 1; i >= head.length; i--) {
        const part = parts[i] as string;
        if (part.length + 2 > budget) break;
        tail.unshift(part);
        budget -= part.length + 2;
    }
    return [...head, "[…]", ...tail].join("\n\n");
}

export function buildPrompt(transcript: string): string {
    return `<conversation>\n${transcript}\n</conversation>\n\nTitle for this conversation:`;
}

/** Turns the model's reply into a one-line title, or undefined if nothing usable is left. */
export function cleanTitle(reply: string): string | undefined {
    const line = reply
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0);
    if (!line) return undefined;

    const title = line
        .replace(/^[#>\s-]+/, "")
        .replace(/^[*_]*(title|назва)[*_]*\s*:[*_]*\s*/i, "")
        .replace(/^[*_`"'«“„\s]+|[*_`"'»”\s]+$/g, "")
        .replace(/[.。]+$/, "")
        .replace(/\s+/g, " ")
        .trim();
    if (!title) return undefined;
    return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : title;
}

/** Custom entry recording a name this extension gave, so it can tell its names from the user's. */
export const AUTO_NAME_ENTRY = "agent-kit:session-name";

export interface AutoName {
    readonly name: string;
    readonly turns: number;
}

export function lastAutoName(entries: readonly unknown[]): AutoName | undefined {
    let last: AutoName | undefined;
    for (const entry of entries as readonly Entry[]) {
        if (entry.type !== "custom" || entry.customType !== AUTO_NAME_ENTRY) continue;
        const data = entry.data as Partial<AutoName> | undefined;
        if (typeof data?.name === "string" && typeof data.turns === "number")
            last = {
                name: data.name,
                turns: data.turns,
            };
    }
    return last;
}

export interface NamingState {
    readonly currentName: string | undefined;
    readonly lastAuto: AutoName | undefined;
    readonly turns: number;
    readonly renameAfterTurns: number;
}

/**
 * Whether a finished turn should (re)name the session. An unnamed session gets a name; one the
 * extension named earlier gets a new one once it reaches `renameAfterTurns`. A name the user gave
 * is never replaced.
 */
export function shouldName(state: NamingState): boolean {
    if (state.turns < 1) return false;
    if (!state.currentName) return true;

    const {lastAuto, renameAfterTurns} = state;
    if (!lastAuto || lastAuto.name !== state.currentName) return false;
    return renameAfterTurns > 1 && state.turns >= renameAfterTurns && lastAuto.turns < renameAfterTurns;
}
