// Pi extension: names sessions with a small model after the first turn, and again after a few more.
// /autoname opens a settings menu, /autoname now renames the session, /autoname status shows the settings.
// Loaded through the "pi.extensions" entry in package.json.

import {join} from "node:path";
import {type ExtensionAPI, type ExtensionCommandContext, type ExtensionContext, getAgentDir} from "@earendil-works/pi-coding-agent";
import {loadConfig, modelRefFor, NAMESPACE, parseModelRef, SECTION, type SessionNameConfig, saveConfig} from "../core/config.js";
import {
    AUTO_NAME_ENTRY,
    buildPrompt,
    buildTranscript,
    cleanTitle,
    countTurns,
    lastAutoName,
    SYSTEM_PROMPT,
    shouldName,
} from "../core/title.js";
import {applyChange, createMenu, type MenuState, menuItems, modelOptions, modelValue, RENAME} from "./menu.js";

type Model = NonNullable<ExtensionContext["model"]>;

const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 512;
const TAG = "Session name";

export interface Options {
    /** Path of the settings file. Defaults to Pi's global settings.json. */
    readonly configPath?: () => string | Promise<string>;
}

const defaultConfigPath = () => join(getAgentDir(), "settings.json");

class NamingError extends Error {}

/** The model to name a session with, or a NamingError saying what is missing. */
function resolveModel(ctx: ExtensionContext, config: SessionNameConfig): Model {
    const provider = ctx.model?.provider;
    const ref = modelRefFor(config, provider);
    if (!ref) {
        const forWhat = provider ? ` for ${provider}` : "";
        throw new NamingError(`no model set${forWhat}. Run /autoname to choose one.`);
    }
    const parsed = parseModelRef(ref);
    const model = parsed && ctx.modelRegistry.find(parsed.provider, parsed.id);
    if (!model) throw new NamingError(`model ${ref} not found. Run /autoname to choose another.`);
    if (!ctx.modelRegistry.hasConfiguredAuth(model))
        throw new NamingError(`${ref} has no credentials. Log in to ${model.provider} or choose another model.`);
    return model;
}

async function generateTitle(ctx: ExtensionContext, model: Model, transcript: string): Promise<string> {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const reply = await ctx.modelRegistry
        .streamSimple(
            model,
            {
                systemPrompt: SYSTEM_PROMPT,
                messages: [{role: "user", content: [{type: "text", text: buildPrompt(transcript)}], timestamp: Date.now()}],
            },
            {maxTokens: MAX_TOKENS, signal},
        )
        .result();
    if (reply.stopReason === "error" || reply.stopReason === "aborted") {
        throw new NamingError(`${model.provider}/${model.id} failed: ${reply.errorMessage ?? reply.stopReason}`);
    }
    const text = reply.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n");
    const title = cleanTitle(text);
    if (!title) throw new NamingError(`${model.provider}/${model.id} returned no title.`);
    return title;
}

const modelRef = (model: Model) => `${model.provider}/${model.id}`;

export function register(pi: ExtensionAPI, options: Options = {}): void {
    const configPath = options.configPath ?? defaultConfigPath;
    const config = async () => loadConfig(await configPath());

    // Session the runtime is on now; a title that arrives after a switch is dropped.
    let sessionId: string | undefined;
    let running = false;
    // Auto-naming errors already shown in this session, so a broken setup isn't reported every turn.
    const shown = new Set<string>();

    /** Names the current session. Throws on failure; returns the name, or undefined if the session changed meanwhile. */
    async function name(ctx: ExtensionContext, cfg: SessionNameConfig): Promise<string | undefined> {
        const branch = ctx.sessionManager.getBranch();
        const transcript = buildTranscript(branch);
        if (!transcript) throw new NamingError("the conversation has no text yet.");
        const model = resolveModel(ctx, cfg);
        const startedIn = ctx.sessionManager.getSessionId();

        const title = await generateTitle(ctx, model, transcript);
        if (startedIn !== sessionId) return undefined;
        pi.setSessionName(title);
        pi.appendEntry(AUTO_NAME_ENTRY, {name: title, turns: countTurns(branch)});
        return title;
    }

    pi.on("session_start", (_event, ctx) => {
        sessionId = ctx.sessionManager.getSessionId();
        shown.clear();
    });

    pi.on("agent_end", (_event, ctx) => {
        if (!ctx.hasUI || running) return;
        // Runs in the background so the next prompt isn't held up by the naming request.
        void (async () => {
            running = true;
            try {
                const cfg = await config();
                if (!cfg.auto) return;
                const entries = ctx.sessionManager.getEntries();
                const state = {
                    currentName: pi.getSessionName(),
                    lastAuto: lastAutoName(entries),
                    turns: countTurns(ctx.sessionManager.getBranch()),
                    renameAfterTurns: cfg.renameAfterTurns,
                };
                if (shouldName(state)) await name(ctx, cfg);
            } catch (error) {
                const message = `${TAG}: ${(error as Error).message}`;
                if (!shown.has(message)) {
                    shown.add(message);
                    ctx.ui.notify(message, "error");
                }
            } finally {
                running = false;
            }
        })();
    });

    async function renameNow(ctx: ExtensionCommandContext): Promise<void> {
        ctx.ui.setStatus("session-name", "Naming the session…");
        try {
            const title = await name(ctx, await config());
            if (title) ctx.ui.notify(`${TAG}: ${title}`, "info");
        } catch (error) {
            ctx.ui.notify(`${TAG}: ${(error as Error).message}`, "error");
        } finally {
            ctx.ui.setStatus("session-name", undefined);
        }
    }

    /** Current settings, models and session, for the menu. */
    async function menuState(ctx: ExtensionContext): Promise<MenuState> {
        return {
            config: await config(),
            models: ctx.modelRegistry.getAvailable().map(modelRef),
            currentProvider: ctx.model?.provider,
            sessionName: pi.getSessionName(),
        };
    }

    // Menu changes are saved in order, one after another.
    let saving = Promise.resolve();
    function persist(ctx: ExtensionContext, next: SessionNameConfig): Promise<void> {
        saving = saving
            .then(async () => saveConfig(await configPath(), next))
            .then(
                () => shown.clear(),
                (error: Error) => ctx.ui.notify(`${TAG}: can't save settings: ${error.message}`, "error"),
            );
        return saving;
    }

    /** The menu in the terminal UI, drawn like /settings. */
    async function tuiMenu(ctx: ExtensionCommandContext): Promise<void> {
        const state = await menuState(ctx);
        const result = await ctx.ui.custom<"rename" | undefined>((tui, theme, _keybindings, done) =>
            createMenu(theme, state, {
                onConfig: (next) => void persist(ctx, next),
                done,
                requestRender: () => tui.requestRender(),
            }),
        );
        await saving;
        if (result === "rename") await renameNow(ctx);
    }

    /** The same menu from plain selects, for RPC clients such as pi-web. */
    async function selectMenu(ctx: ExtensionCommandContext): Promise<void> {
        const state = await menuState(ctx);
        const items = menuItems(state);
        const labels = new Map(items.map((item) => [`${item.label}  ·  ${item.value}`, item]));
        const picked = await ctx.ui.select("Session names", [...labels.keys()]);
        const item = picked === undefined ? undefined : labels.get(picked);
        if (!item) return;
        if (item.id === RENAME) return renameNow(ctx);

        let value: string | undefined;
        if (item.model) {
            const options = modelOptions(state, item.model.provider);
            const byLabel = new Map(options.map((o) => [o.label, o.value]));
            const label = await ctx.ui.select(item.label, [...byLabel.keys()]);
            value = label === undefined ? undefined : byLabel.get(label);
        } else {
            value = await ctx.ui.select(item.label, [...(item.values ?? [])]);
        }
        if (value === undefined) return;
        const next = applyChange(state.config, item.id, value);
        if (!next) return;
        await persist(ctx, next);
        ctx.ui.notify(`${TAG}: ${item.label} → ${item.model ? modelValue(next, item.model.provider) : value}`, "info");
    }

    async function menu(ctx: ExtensionCommandContext): Promise<void> {
        if (ctx.mode === "tui") return tuiMenu(ctx);
        if (ctx.hasUI) return selectMenu(ctx);
        return status(ctx);
    }

    async function status(ctx: ExtensionCommandContext): Promise<void> {
        const cfg = await config();
        const provider = ctx.model?.provider;
        let auto = "off";
        if (cfg.auto) auto = cfg.renameAfterTurns > 1 ? `after the first turn and turn ${cfg.renameAfterTurns}` : "after the first turn";
        const lines = [
            `Name: ${pi.getSessionName() ?? "not set"}`,
            `Model for this session: ${modelRefFor(cfg, provider) ?? "not set"}`,
            `Fallback model: ${cfg.fallback ?? "not set"}`,
            ...Object.entries(cfg.models).map(([p, ref]) => `${p}: ${ref}`),
            `Automatic: ${auto}`,
            `Settings: "${NAMESPACE}.${SECTION}" in ${await configPath()}`,
        ];
        ctx.ui.notify(lines.join("\n"), "info");
    }

    const subcommands = {
        now: {description: "Name the session now from the conversation", run: renameNow},
        status: {description: "Show the session name settings", run: status},
    } as const;

    pi.registerCommand("autoname", {
        description: "Session names: open the menu (or: now, status)",
        getArgumentCompletions: (prefix) => {
            const items = Object.entries(subcommands)
                .filter(([value]) => value.startsWith(prefix.trim()))
                .map(([value, {description}]) => ({value, label: value, description}));
            return items.length > 0 ? items : null;
        },
        handler: async (args, ctx) => {
            const sub = args.trim();
            const command = sub ? subcommands[sub as keyof typeof subcommands] : {run: menu};
            if (!command) {
                ctx.ui.notify(`${TAG}: unknown subcommand "${sub}". Use now or status, or no argument for the menu.`, "error");
                return;
            }
            try {
                await command.run(ctx);
            } catch (error) {
                ctx.ui.notify(`${TAG}: ${(error as Error).message}`, "error");
            }
        },
    });
}

export default function sessionName(pi: ExtensionAPI): void {
    register(pi);
}
