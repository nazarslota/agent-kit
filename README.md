# agent-kit

Extensions for coding agents: [Pi](https://github.com/earendil-works/pi), Claude Code and Codex.

## Status line

```
◆ agent-kit · ⎇ main │ Opus 5.5 · high │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k ⇥546k
```

Repo, branch, model, context use, session input (↑) and output (↓) tokens, and the tokens left before
the agent compacts (⇥).

`AGENT_KIT_LABEL` adds a label at the right edge, e.g. a profile name. In Claude Code and Pi the line
uses the terminal's 16-color palette, so it follows the terminal theme, light or dark.

**Pi**

```sh
pi install npm:@nazarslota/agent-kit
```

To update it: `pi update --extension npm:@nazarslota/agent-kit`. To remove it:
`pi remove npm:@nazarslota/agent-kit`.

**Claude Code**

```sh
npm i -g @nazarslota/agent-kit
agent-kit setup claude
```

`setup` sets `statusLine` in `~/.claude/settings.json` to `agent-kit statusline`. To update, run
`npm i -g @nazarslota/agent-kit` again. To remove it:

```sh
agent-kit uninstall claude
npm rm -g @nazarslota/agent-kit
```

**Codex** can't run a custom status line. Its built-in items come close, in `~/.codex/config.toml`:

```toml
[tui]
status_line = ["project-name", "git-branch", "model-with-reasoning", "context-used", "context-window-size"]
```

## Session names (Pi)

Pi shows a session's first message in `/resume` until someone names it. This extension asks a small
model for a short title, written in the language of the conversation. It names the session after the
first turn and again after turn 5, when there is more to go on. A name you give with `/name` or
`--name` is never replaced.

It comes with the Pi package above. `/autoname` opens its menu, laid out like `/settings`:

```text
 Session names

→ Rename this session now      Налаштування nginx як reverse proxy
  Name sessions automatically  on
  Rename again after turn      5
  Fallback model               anthropic/claude-haiku-5-5
  Model for anthropic          anthropic/claude-haiku-5-5 (fallback)
  Model for openai-codex       openai-codex/gpt-6-luna
```

Choose a model before the first use. A provider's own model names the sessions that run on that
provider, e.g. `openai-codex/gpt-6-luna` for Codex. The fallback model names the rest; a provider row
without its own model shows it, marked `(fallback)`. With one model for everything, set only the
fallback. Model lists
show the models you're logged in to; type to filter them. In pi-web and other RPC clients the same
menu comes as a list of choices.

`/autoname now` names the session straight away, from the whole conversation. `/autoname status`
shows the settings.

Without a model for the session's provider, the extension reports an error once per session. The
settings are kept in Pi's global `settings.json` (`~/.pi/agent/settings.json` by default), under
`agentKit.sessionName`. Pi leaves keys it doesn't know alone, so they survive its own writes:

```json
{
  "agentKit": {
    "sessionName": {
      "fallback": "anthropic/claude-haiku-5-5",
      "models": {"openai-codex": "openai-codex/gpt-6-luna"},
      "auto": true,
      "renameAfterTurns": 5
    }
  }
}
```

`renameAfterTurns: 0` turns off the second naming.

## Development

```sh
npm ci
npm run typecheck
npm run lint        # Biome: lint and format check (npm run format fixes)
npm test            # unit tests
```

To release, bump the version and push the tag; GitHub Actions publishes it to npm:

```sh
npm version patch -m "chore: release %s"
git push --follow-tags
```
