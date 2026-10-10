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
