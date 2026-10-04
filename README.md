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

**Claude Code**

```sh
git clone https://github.com/nazarslota/agent-kit ~/agent-kit
cd ~/agent-kit && npm ci && npm run build
```

Then point `statusLine` at it in `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "node ~/agent-kit/dist/statusline/claude/main.js"
}
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
