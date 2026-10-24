// Settings for session naming, kept in Pi's own settings.json under "agentKit.sessionName":
//
// {
//   "agentKit": {
//     "sessionName": {
//       "fallback": "anthropic/claude-haiku-5-5",
//       "models": {"openai-codex": "openai-codex/gpt-6-luna"},
//       "auto": true,
//       "renameAfterTurns": 5
//     }
//   }
// }
//
// Pi keeps keys it doesn't know: when it saves, it rereads the file and writes back only the fields it changed.

import {mkdir, readFile, rmdir, stat, writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";

export interface SessionNameConfig {
    /** Fallback model for providers without their own entry, as "provider/model-id". */
    readonly fallback?: string;
    /** Model per provider of the session's model, as "provider/model-id". */
    readonly models: Readonly<Record<string, string>>;
    /** Name sessions on their own after the first turn. */
    readonly auto: boolean;
    /** Name the session again after this many turns, if it still has the name given after the first. 0 turns it off. */
    readonly renameAfterTurns: number;
}

export const DEFAULT_RENAME_AFTER_TURNS = 5;

export const DEFAULT_CONFIG: SessionNameConfig = {models: {}, auto: true, renameAfterTurns: DEFAULT_RENAME_AFTER_TURNS};

/** Where the section sits in settings.json. */
export const NAMESPACE = "agentKit";
export const SECTION = "sessionName";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads the section from parsed settings.json, falling back to defaults for anything missing or malformed. */
export function parseConfig(file: unknown): SessionNameConfig {
    const namespace = isRecord(file) ? file[NAMESPACE] : undefined;
    const section = isRecord(namespace) ? namespace[SECTION] : undefined;
    if (!isRecord(section)) return DEFAULT_CONFIG;

    const models: Record<string, string> = {};
    if (isRecord(section.models)) {
        for (const [provider, ref] of Object.entries(section.models)) {
            if (typeof ref === "string" && ref.trim()) models[provider] = ref.trim();
        }
    }
    const turns = section.renameAfterTurns;
    return {
        ...(typeof section.fallback === "string" && section.fallback.trim() ? {fallback: section.fallback.trim()} : {}),
        models,
        auto: typeof section.auto === "boolean" ? section.auto : DEFAULT_CONFIG.auto,
        renameAfterTurns: typeof turns === "number" && Number.isInteger(turns) && turns >= 0 ? turns : DEFAULT_RENAME_AFTER_TURNS,
    };
}

/** The configured model for a session whose model comes from `provider`. */
export function modelRefFor(config: SessionNameConfig, provider: string | undefined): string | undefined {
    return (provider ? config.models[provider] : undefined) ?? config.fallback;
}

/** Splits "provider/model-id"; the id may contain slashes itself. */
export function parseModelRef(ref: string): {provider: string; id: string} | undefined {
    const slash = ref.indexOf("/");
    if (slash <= 0 || slash === ref.length - 1) return undefined;
    return {provider: ref.slice(0, slash), id: ref.slice(slash + 1)};
}

async function readJson(path: string): Promise<unknown> {
    let text: string;
    try {
        text = await readFile(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
        throw error;
    }
    try {
        return JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch (error) {
        throw new Error(`Can't read ${path}: ${(error as Error).message}`);
    }
}

export async function loadConfig(path: string): Promise<SessionNameConfig> {
    return parseConfig(await readJson(path));
}

/** A lock older than this is left over from a crashed process, as proper-lockfile (used by Pi) judges it. */
const STALE_LOCK_MS = 10_000;
const LOCK_ATTEMPTS = 50;
const LOCK_RETRY_MS = 20;

/**
 * Holds the same lock Pi takes on settings.json while it writes: the "<path>.lock" directory
 * that proper-lockfile creates.
 */
async function withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const lock = `${path}.lock`;
    for (let attempt = 0; ; attempt++) {
        try {
            await mkdir(lock);
            break;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
            const age = await stat(lock).then(
                (s) => Date.now() - s.mtimeMs,
                () => 0,
            );
            if (age > STALE_LOCK_MS) await rmdir(lock).catch(() => {});
            else if (attempt >= LOCK_ATTEMPTS) throw new Error(`${path} is locked by another process. Try again.`);
            else await sleep(LOCK_RETRY_MS);
        }
    }
    try {
        return await fn();
    } finally {
        await rmdir(lock).catch(() => {});
    }
}

/** Writes the section back, keeping every other key of the file. */
export async function saveConfig(path: string, config: SessionNameConfig): Promise<void> {
    await mkdir(dirname(path), {recursive: true});
    await withLock(path, async () => {
        const file = await readJson(path);
        const root = isRecord(file) ? file : {};
        const namespace = isRecord(root[NAMESPACE]) ? root[NAMESPACE] : {};
        const section: Record<string, unknown> = {
            ...(config.fallback ? {fallback: config.fallback} : {}),
            models: config.models,
            auto: config.auto,
            renameAfterTurns: config.renameAfterTurns,
        };
        const next = {...root, [NAMESPACE]: {...namespace, [SECTION]: section}};
        // Written in place, as Pi does, so a symlinked settings.json stays a symlink.
        await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
    });
}
