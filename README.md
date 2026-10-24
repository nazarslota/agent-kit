# agent-kit

A status line and automatic session names for [Pi](https://github.com/earendil-works/pi). The status
line also works in Claude Code.

## Install in Pi

```sh
pi install npm:@nazarslota/agent-kit
```

Update with `pi update --extension npm:@nazarslota/agent-kit`. Remove with
`pi remove npm:@nazarslota/agent-kit`.

The package loads both extensions. To keep one, replace the package entry in
`~/.pi/agent/settings.json` with a filter:

```json
{
  "packages": [
    {"source": "npm:@nazarslota/agent-kit", "extensions": ["src/session-name/pi/extension.ts"]}
  ]
}
```

Use `src/statusline/pi/extension.ts` for the status line alone, or toggle either in `pi config`.

## Status line

```text
◆ agent-kit · ⎇ main │ Opus 5.5 · high │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k ⇥546k
```

It shows the repo, branch, model, context use, session input (↑) and output (↓) tokens, and the
tokens left before compaction (⇥). `AGENT_KIT_LABEL` adds a label at the right edge, such as a
profile name. Colors come from your terminal's 16-color palette and follow its light or dark theme.

For Claude Code:

```sh
npm i -g @nazarslota/agent-kit
agent-kit setup claude
```

`setup` points `statusLine` in `~/.claude/settings.json` to `agent-kit statusline`. Run `npm i -g`
again to update. To remove:

```sh
agent-kit uninstall claude
npm rm -g @nazarslota/agent-kit
```

Codex has no custom status line. Its built-in items come close, in `~/.codex/config.toml`:

```toml
[tui]
status_line = ["project-name", "git-branch", "model-with-reasoning", "context-used", "context-window-size"]
```

## Session names

After the first turn, a small model names the session in the language you write in. After turn 5 it
names the session again. A name you set with `/name` or `--name` stays.

`/autoname` opens the settings:

```text
 Session names

→ Rename this session now      Налаштування nginx як reverse proxy
  Name sessions automatically  on
  Rename again after turn      5
  Fallback model               anthropic/claude-haiku-5-5
  Model for anthropic          anthropic/claude-haiku-5-5 (fallback)
  Model for openai-codex       openai-codex/gpt-6-luna
```

Pick a model before the first use. Give a provider its own model, and the fallback covers the rest.
For one model everywhere, set only the fallback. Without a model, Pi shows an error once per session.

`/autoname now` renames the session from the whole conversation. `/autoname status` prints the
settings. They live in `~/.pi/agent/settings.json` under `agentKit.sessionName`.

## Development

```sh
npm ci
npm run typecheck
npm run lint        # Biome; npm run format fixes
npm test
```

To release, bump the version and push the tag. GitHub Actions publishes to npm:

```sh
npm version patch -m "chore: release %s"
git push --follow-tags
```
