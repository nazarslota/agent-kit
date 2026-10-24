# agent-kit

Two extensions for coding agents: a status line for Pi and Claude Code, and automatic session names
for [Pi](https://github.com/earendil-works/pi).

## Status line

```text
◆ agent-kit · ⎇ main │ Opus 5.5 · high │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k ⇥546k
```

It shows the repo, branch, model, context use, session input (↑) and output (↓) tokens, and the
tokens left before compaction (⇥). `AGENT_KIT_LABEL` adds a label at the right edge, such as a
profile name. Colors come from your terminal's 16-color palette and follow its light or dark theme.

### Pi

```sh
pi install npm:@nazarslota/agent-kit
```

### Claude Code

```sh
npm i -g @nazarslota/agent-kit
agent-kit setup claude
```

`setup` points `statusLine` in `~/.claude/settings.json` to `agent-kit statusline`.

## Session names

Pi only. After the first turn, a small model names the session in the language you write in. After
turn 5 it names the session again. A name you set with `/name` or `--name` stays.

### Pi

```sh
pi install npm:@nazarslota/agent-kit
```

Then run `/autoname` and pick a model:

```text
 Session names

→ Rename this session now      Set up nginx as a reverse proxy
  Name sessions automatically  on
  Rename again after turn      5
  Fallback model               anthropic/claude-haiku-5-5
  Model for anthropic          anthropic/claude-haiku-5-5 (fallback)
  Model for openai             openai/gpt-6-luna
```

Give a provider its own model, and the fallback covers the rest. For one model everywhere, set only
the fallback. Without a model, Pi shows an error once per session.

`/autoname now` renames the session from the whole conversation. `/autoname status` prints the
settings. They live in `~/.pi/agent/settings.json` under `agentKit.sessionName`.

## Turn off an extension in Pi

The Pi package loads both extensions. To turn one off, replace the package entry in
`~/.pi/agent/settings.json` with a filter. Without the status line:

```json
{"source": "npm:@nazarslota/agent-kit", "extensions": ["!src/statusline/**"]}
```

Without session names:

```json
{"source": "npm:@nazarslota/agent-kit", "extensions": ["!src/session-name/**"]}
```

`pi config` toggles them too. Restart Pi to apply.

## Update and remove

Pi:

```sh
pi update --extension npm:@nazarslota/agent-kit
pi remove npm:@nazarslota/agent-kit
```

Claude Code: run `npm i -g @nazarslota/agent-kit` again to update. To remove:

```sh
agent-kit uninstall claude
npm rm -g @nazarslota/agent-kit
```

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
