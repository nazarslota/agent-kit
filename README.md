# agent-kit

Extensions for coding agents: [Pi](https://github.com/earendil-works/pi), Claude Code and Codex.

## Status line

```
◆ agent-kit  main │ Opus 5.5 thinking │ ━━━━────── 421k/1M 42% · ↑890k ↓8.4k · ⇥546k
```

Repo, branch, model, context use, session input (↑) and output (↓) tokens, and the tokens left before
the agent compacts (⇥).

**Pi**

```sh
pi install git:github.com/nazarslota/agent-kit
```

To remove it: `pi remove git:github.com/nazarslota/agent-kit`.

**Claude Code**

```sh
npm i -g @nazarslota/agent-kit
agent-kit setup claude
```

`setup` sets `statusLine` in `~/.claude/settings.json` to `agent-kit statusline`. To remove it:

```sh
agent-kit uninstall claude
npm rm -g @nazarslota/agent-kit
```

**Codex** can't run a custom status line. Its built-in items come close, in `~/.codex/config.toml`:

```toml
[tui]
status_line = ["project-name", "git-branch", "model-with-reasoning", "context-used", "context-window-size"]
```

## Development

```sh
npm ci
npm run lint   # Biome: lint and format check (npm run format fixes)
npm test       # unit tests
```

To release, bump the version and push the tag; GitHub Actions publishes it to npm:

```sh
npm version patch
git push --follow-tags
```
