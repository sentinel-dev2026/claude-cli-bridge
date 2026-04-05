import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// ============================================================
// Claude CLI Bridge Plugin for OpenClaw
// ============================================================
// Manages an on-demand Claude Code CLI process via stream-json.
// Tools: claude_start, claude_send, claude_stop, claude_status

let proc = null;
let rl = null;
let ready = false;
let sessionId = null;
let resultResolve = null;
let chunks = [];
let lastActivity = null;
let idleTimer = null;
let pluginConfig = {};

function handleEvent(data) {
  switch (data.type) {
    case 'system':
      if (data.subtype === 'init') {
        ready = true;
        sessionId = data.session_id;
      }
      break;
    case 'assistant':
      if (data.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'text') chunks.push(block.text);
        }
      }
      break;
    case 'result': {
      const text = data.result || chunks.join('');
      chunks = [];
      if (resultResolve) {
        resultResolve({
          text,
          cost: data.total_cost_usd || 0,
          turns: data.num_turns || 0,
          usage: data.usage || {},
        });
        resultResolve = null;
      }
      break;
    }
  }
}

function resetIdleTimer() {
  lastActivity = Date.now();
  if (idleTimer) clearTimeout(idleTimer);
  const minutes = pluginConfig.idleTimeoutMinutes || 10;
  idleTimer = setTimeout(() => {
    if (proc) {
      killProcess();
    }
  }, minutes * 60 * 1000);
}

function killProcess() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (proc) {
    try { proc.kill(); } catch (_) {}
    proc = null;
  }
  if (rl) {
    try { rl.close(); } catch (_) {}
    rl = null;
  }
  ready = false;
  sessionId = null;
  if (resultResolve) {
    resultResolve({ text: '[プロセス終了]', cost: 0, turns: 0, usage: {} });
    resultResolve = null;
  }
  chunks = [];
}

function startProcess(config = {}) {
  if (proc) return { ok: false, error: 'already running' };

  pluginConfig = config;
  const systemPrompt = config.systemPrompt || 'あなたはClaude。OpenClawから呼び出された補助AIアシスタント。指示されたタスクを簡潔・正確にこなす。';
  const args = [
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--no-session-persistence',
    '--system-prompt', systemPrompt,
  ];

  if (config.model) {
    args.push('--model', config.model);
  }

  proc = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.env.HOME || '/home/runrara',
  });

  rl = createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    try {
      handleEvent(JSON.parse(line));
    } catch (_) {}
  });

  proc.stderr.on('data', () => {});

  proc.on('close', (code) => {
    proc = null;
    rl = null;
    ready = false;
    sessionId = null;
    if (resultResolve) {
      resultResolve({ text: `[プロセス終了 code=${code}]`, cost: 0, turns: 0, usage: {} });
      resultResolve = null;
    }
  });

  proc.on('error', (err) => {
    if (resultResolve) {
      resultResolve({ text: `[起動エラー: ${err.message}]`, cost: 0, turns: 0, usage: {} });
      resultResolve = null;
    }
  });

  resetIdleTimer();
  return { ok: true };
}

function sendMessage(text, timeoutMs = 300000) {
  return new Promise((resolve) => {
    if (!proc || !proc.stdin.writable) {
      resolve({ text: '[プロセスが起動していません。claude_startを先に呼んでください]', cost: 0, turns: 0, usage: {} });
      return;
    }

    resultResolve = resolve;
    chunks = [];

    const msg = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: text }
    }) + '\n';

    proc.stdin.write(msg);
    resetIdleTimer();

    setTimeout(() => {
      if (resultResolve === resolve) {
        resultResolve = null;
        resolve({ text: '[タイムアウト (5分)]', cost: 0, turns: 0, usage: {} });
      }
    }, timeoutMs);
  });
}

// ============================================================
// Plugin entry — exports tools for OpenClaw
// ============================================================

// Dynamic import for definePluginEntry
const entry = {
  id: 'claude-cli-bridge',
  name: 'Claude CLI Bridge',
  description: 'On-demand Claude Code CLI process management via stream-json.',

  register(api) {
    api.registerTool({
      name: 'claude_start',
      description: 'Start a Claude Code CLI process. Call this before claude_send. Config options: systemPrompt (string), model (string), idleTimeoutMinutes (number, default 10).',
      parameters: {
        type: 'object',
        properties: {
          systemPrompt: { type: 'string', description: 'System prompt for the session' },
          model: { type: 'string', description: 'Model to use (e.g. claude-opus-4-6)' },
          idleTimeoutMinutes: { type: 'number', description: 'Auto-stop after N minutes idle (default: 10)' },
        },
      },
      async execute(params) {
        if (proc) {
          return { content: [{ type: 'text', text: `既に起動中 (session=${sessionId?.slice(0,8)})。新しく起動するには先にclaude_stopを呼んでください。` }] };
        }
        const config = {
          ...pluginConfig,
          ...(params.systemPrompt && { systemPrompt: params.systemPrompt }),
          ...(params.model && { model: params.model }),
          ...(params.idleTimeoutMinutes && { idleTimeoutMinutes: params.idleTimeoutMinutes }),
        };
        const result = startProcess(config);
        if (!result.ok) {
          return { content: [{ type: 'text', text: `起動失敗: ${result.error}` }] };
        }

        // 初回メッセージで初期化を待つ
        const initResult = await sendMessage('準備完了と返答してください。');
        return { content: [{ type: 'text', text: `Claude CLI 起動完了 (session=${sessionId?.slice(0,8)})\n初期応答: ${initResult.text}` }] };
      },
    });

    api.registerTool({
      name: 'claude_send',
      description: 'Send a message to the running Claude CLI process and get a response. The process must be started first with claude_start.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to send to Claude' },
        },
        required: ['message'],
      },
      async execute(params) {
        const result = await sendMessage(params.message);
        return {
          content: [{
            type: 'text',
            text: `${result.text}\n\n---\n[cost: $${result.cost.toFixed(4)}, turns: ${result.turns}]`
          }]
        };
      },
    });

    api.registerTool({
      name: 'claude_stop',
      description: 'Stop the running Claude CLI process. Use when the task is complete.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        if (!proc) {
          return { content: [{ type: 'text', text: 'プロセスは起動していません。' }] };
        }
        const sid = sessionId?.slice(0, 8);
        killProcess();
        return { content: [{ type: 'text', text: `Claude CLI プロセス停止 (session=${sid})` }] };
      },
    });

    api.registerTool({
      name: 'claude_status',
      description: 'Check the status of the Claude CLI process.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        if (!proc) {
          return { content: [{ type: 'text', text: 'ステータス: 停止中' }] };
        }
        const idle = lastActivity ? Math.round((Date.now() - lastActivity) / 1000) : 0;
        const timeoutMin = pluginConfig.idleTimeoutMinutes || 10;
        return {
          content: [{
            type: 'text',
            text: `ステータス: 稼働中\nセッション: ${sessionId?.slice(0,8)}\nアイドル: ${idle}秒\n自動停止: ${timeoutMin}分`
          }]
        };
      },
    });
  },
};

export default entry;
