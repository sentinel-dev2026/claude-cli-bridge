# claude-cli-bridge

An OpenClaw plugin that bridges the `claude` CLI through `stream-json`.

This repository is primarily documented in Japanese. If you are looking for the main documentation, please check `README.md`.

## What it does

- Starts a Claude CLI process on demand
- Sends messages to the running session
- Checks process/session status
- Stops the process explicitly or after an idle timeout

## Tools

- `claude_start`
- `claude_send`
- `claude_status`
- `claude_stop`

## Files

- `index.js` — main plugin implementation
- `openclaw.plugin.json` — plugin metadata and config schema
- `skills/claude-assist/SKILL.md` — usage guidance for when to invoke Claude CLI

## Requirements

- OpenClaw
- `claude` CLI installed and available in `PATH`
- Claude CLI support for `stream-json` I/O

## License

MIT License. See `LICENSE`.
