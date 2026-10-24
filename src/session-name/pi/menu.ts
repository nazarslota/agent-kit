// The /autoname menu: what it lists, how a change maps onto the settings, and the TUI that shows it.
// The TUI looks like Pi's /settings: it uses the same SettingsList and theme.

import {DynamicBorder, getSelectListTheme, getSettingsListTheme, type Theme} from "@earendil-works/pi-coding-agent";
import {
    type Component,
    Container,
    fuzzyFilter,
    getKeybindings,
    Input,
    type SelectItem,
    SelectList,
    type SettingItem,
    SettingsList,
    Spacer,
    Text,
} from "@earendil-works/pi-tui";
import type {SessionNameConfig} from "../core/config.js";

export const RENAME = "rename";
export const AUTO = "auto";
export const RENAME_AFTER = "renameAfter";
export const FALLBACK_MODEL = "fallback";
const PROVIDER_PREFIX = "model:";

const OFF = "off";
const NOT_SET = "not set";
const USE_FALLBACK = "fallback";
const TURN_CHOICES = [3, 5, 10];

export interface MenuState {
    readonly config: SessionNameConfig;
    /** Available models as "provider/model-id". */
    readonly models: readonly string[];
    /** Provider of the session's model, listed first. */
    readonly currentProvider: string | undefined;
    readonly sessionName: string | undefined;
}

export interface MenuItem {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly value: string;
    /** Values Enter cycles through. */
    readonly values?: readonly string[];
    /** Opens a list of models for this provider, or for the fallback when undefined. */
    readonly model?: {readonly provider: string | undefined};
}

export const providerOf = (ref: string) => ref.slice(0, Math.max(ref.indexOf("/"), 0));
export const providerItemId = (provider: string) => `${PROVIDER_PREFIX}${provider}`;

/** Providers of the available models and of configured entries, the session's own first. */
export function providers(state: MenuState): string[] {
    const all = new Set([...state.models.map(providerOf), ...Object.keys(state.config.models)].filter(Boolean));
    const current = state.currentProvider;
    return [...all].sort((a, b) => Number(b === current) - Number(a === current) || a.localeCompare(b));
}

export function menuItems(state: MenuState): MenuItem[] {
    const {config} = state;
    const turns = config.renameAfterTurns > 1 ? String(config.renameAfterTurns) : OFF;
    const turnValues = [...new Set([...TURN_CHOICES, config.renameAfterTurns].filter((n) => n > 1))].sort((a, b) => a - b).map(String);
    const name = state.sessionName ?? "unnamed";

    return [
        {
            id: RENAME,
            label: "Rename this session now",
            description: "Ask the model for a new name from the whole conversation. Replaces a name you gave too.",
            value: name,
            values: [name],
        },
        {
            id: AUTO,
            label: "Name sessions automatically",
            description: "Name a session after its first turn. A name you give with /name is never replaced.",
            value: config.auto ? "on" : OFF,
            values: ["on", OFF],
        },
        {
            id: RENAME_AFTER,
            label: "Rename again after turn",
            description: "Give the automatic name another go once the conversation has more to go on.",
            value: turns,
            values: [...turnValues, OFF],
        },
        {
            id: FALLBACK_MODEL,
            label: "Fallback model",
            description: "Fallback: names sessions whose provider has no model of its own. Set only this to use one model for all.",
            value: modelValue(config, undefined),
            model: {provider: undefined},
        },
        ...providers(state).map(
            (provider): MenuItem => ({
                id: providerItemId(provider),
                label: `Model for ${provider}`,
                description: `Names sessions that run on a ${provider} model.`,
                value: modelValue(config, provider),
                model: {provider},
            }),
        ),
    ];
}

/** Options of a model list: unset first, then the models the setting can take. */
export function modelOptions(state: MenuState, provider: string | undefined): SelectItem[] {
    const models = provider === undefined ? state.models : state.models.filter((ref) => providerOf(ref) === provider);
    const unset: SelectItem =
        provider === undefined
            ? {value: "", label: NOT_SET, description: "Providers without their own model aren't named"}
            : {value: "", label: USE_FALLBACK, description: `Use the fallback model (${state.config.fallback ?? NOT_SET})`};
    return [unset, ...models.map((ref) => ({value: ref, label: ref}))];
}

/** The settings after the menu item `id` takes `value`, or undefined when the item isn't a setting. */
export function applyChange(config: SessionNameConfig, id: string, value: string): SessionNameConfig | undefined {
    if (id === AUTO) return {...config, auto: value === "on"};
    if (id === RENAME_AFTER) {
        const turns = value === OFF ? 0 : Number(value);
        return Number.isInteger(turns) ? {...config, renameAfterTurns: turns} : undefined;
    }
    if (id === FALLBACK_MODEL) {
        const {fallback: _old, ...rest} = config;
        return value ? {...rest, fallback: value} : rest;
    }
    if (id.startsWith(PROVIDER_PREFIX)) {
        const provider = id.slice(PROVIDER_PREFIX.length);
        const {[provider]: _old, ...others} = config.models;
        return {...config, models: value ? {...others, [provider]: value} : others};
    }
    return undefined;
}

/** How a model setting reads in the menu: the model that will be used, marked when it is the fallback. */
export function modelValue(config: SessionNameConfig, provider: string | undefined): string {
    const own = provider === undefined ? config.fallback : config.models[provider];
    if (own) return own;
    if (provider !== undefined && config.fallback) return `${config.fallback} (${USE_FALLBACK})`;
    return NOT_SET;
}

/** A searchable model list, like the ones in Pi's /settings. */
class ModelList extends Container {
    private list: SelectList;
    private readonly listIndex: number;
    private readonly search = new Input();

    constructor(
        theme: Theme,
        title: string,
        private readonly options: SelectItem[],
        current: string,
        private readonly onSelect: (value: string) => void,
        private readonly onCancel: () => void,
    ) {
        super();
        this.addChild(new Text(theme.bold(theme.fg("accent", title)), 0, 0));
        this.addChild(new Spacer(1));
        this.search.onSubmit = () => this.list.handleInput("\r");
        this.addChild(this.search);
        this.addChild(new Spacer(1));
        this.list = this.build(options, current);
        this.listIndex = this.children.length;
        this.addChild(this.list);
        this.addChild(new Spacer(1));
        this.addChild(new Text(theme.fg("dim", "  Type to filter · Enter to select · Esc to go back"), 0, 0));
    }

    private build(options: SelectItem[], current: string): SelectList {
        const list = new SelectList(options, Math.min(Math.max(options.length, 1), 10), getSelectListTheme());
        const index = options.findIndex((o) => o.value === current);
        if (index >= 0) list.setSelectedIndex(index);
        list.onSelect = (item) => this.onSelect(item.value);
        list.onCancel = this.onCancel;
        return list;
    }

    handleInput(data: string): void {
        const kb = getKeybindings();
        const nav = ["tui.select.up", "tui.select.down", "tui.select.confirm", "tui.select.cancel"] as const;
        if (nav.some((key) => kb.matches(data, key))) {
            this.list.handleInput(data);
            return;
        }
        this.search.handleInput(data);
        const query = this.search.getValue();
        const filtered = query ? fuzzyFilter(this.options, query, (o) => `${o.label} ${o.description ?? ""}`) : this.options;
        this.list = this.build(filtered, "");
        this.children[this.listIndex] = this.list;
    }
}

export interface MenuCallbacks {
    /** Saves changed settings. */
    readonly onConfig: (config: SessionNameConfig) => void;
    /** Closes the menu; `rename` asks for a new name right after. */
    readonly done: (result: "rename" | undefined) => void;
    /** Redraws after a key press. */
    readonly requestRender: () => void;
}

/** The /autoname menu as a TUI component for ctx.ui.custom. */
export function createMenu(theme: Theme, state: MenuState, callbacks: MenuCallbacks): Component {
    let config = state.config;
    const current = () => ({...state, config});
    const items = menuItems(state);

    const change = (id: string, value: string) => {
        const next = applyChange(config, id, value);
        if (!next) return;
        config = next;
        callbacks.onConfig(next);
        // Rows that use the fallback show it, so they change with it.
        for (const row of menuItems(current())) if (row.model) list.updateValue(row.id, row.value);
    };

    const settingItems: SettingItem[] = items.map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        currentValue: item.value,
        ...(item.values ? {values: [...item.values]} : {}),
        ...(item.model
            ? {
                  submenu: (_value: string, done: (value?: string) => void) => {
                      const provider = item.model?.provider;
                      const set = provider === undefined ? config.fallback : config.models[provider];
                      return new ModelList(
                          theme,
                          provider === undefined ? "Fallback model" : `Model for ${provider}`,
                          modelOptions(current(), provider),
                          set ?? "",
                          (ref) => {
                              // change() redraws the row; a value passed to done() would go back through onChange.
                              change(item.id, ref);
                              done();
                          },
                          () => done(),
                      );
                  },
              }
            : {}),
    }));

    const list = new SettingsList(
        settingItems,
        Math.min(settingItems.length + 2, 15),
        getSettingsListTheme(),
        (id, value) => {
            if (id === RENAME) callbacks.done("rename");
            else change(id, value);
        },
        () => callbacks.done(undefined),
    );

    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.bold(theme.fg("accent", "Session names")), 1, 0));
    container.addChild(new Spacer(1));
    container.addChild(list);
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
        render: (width) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data) => {
            list.handleInput(data);
            callbacks.requestRender();
        },
    };
}
