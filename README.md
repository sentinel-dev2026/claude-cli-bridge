# claude-cli-bridge

OpenClaw plugin that manages an on-demand Claude Code CLI process over `stream-json`.

It provides a small set of tools for starting a Claude CLI session, sending messages to it, checking status, and stopping it.

## Features

- Start Claude Code CLI on demand
- Communicate with the process via OpenClaw tools
- Auto-stop after an idle timeout
- Optional system prompt and model selection

## Files

- `index.js` — plugin implementation
- `openclaw.plugin.json` — plugin metadata and config schema
- `package.json` — package metadata

## Exposed tools

- `claude_start`
- `claude_send`
- `claude_status`
- `claude_stop`

## Configuration

The plugin supports the following config values:

- `systemPrompt` — system prompt for the Claude CLI session
- `model` — Claude model name
- `idleTimeoutMinutes` — auto-stop timeout after inactivity

## Notes

- This plugin expects the `claude` CLI to be installed and available in `PATH`.
- It starts the Claude CLI with stream-json input/output mode.
- Session persistence is disabled; the process is intended to be ephemeral.
