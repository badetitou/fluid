import { spawn, execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { ChatMessage, LlmConfig, LlmDeltaHandler } from './types';
import { LlmError } from './errors';

// The `claude-code` provider drives the locally installed Claude Code CLI in
// headless mode (`claude -p`). It authenticates with whatever account the CLI is
// logged into — typically a Claude Pro/Max subscription — so no API key is
// needed. It only works where the BFF runs next to a logged-in CLI (local dev),
// not inside the container images.

const DEFAULT_TIMEOUT_MS = 240_000;

function timeoutMs(): number {
  const v = Number(process.env.CLAUDE_CODE_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
}

/**
 * Child environment for the CLI. ANTHROPIC_API_KEY is dropped so the CLI uses
 * the logged-in subscription instead of silently billing an API key, and
 * CLAUDECODE is dropped so a BFF started from inside a Claude Code session
 * does not look like a nested session.
 */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDECODE;
  return env;
}

let detected: Promise<string | null> | null = null;

/** Detect the CLI once (cached): resolves to its version string, or null when unavailable. */
export function detectClaudeCode(bin: string): Promise<string | null> {
  detected ??= new Promise((resolve) => {
    execFile(bin, ['--version'], { timeout: 10_000, env: childEnv() }, (err, stdout) => {
      resolve(err ? null : stdout.trim() || 'unknown');
    });
  });
  return detected;
}

/**
 * Flatten a chat into the single prompt `claude -p` reads from stdin. The system
 * message goes to `--system-prompt`; earlier turns are replayed inside tags so
 * refinements keep their context.
 */
export function toCliPrompt(messages: ChatMessage[]): { system: string; prompt: string } {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const turns = messages.filter((m) => m.role !== 'system');
  const last = turns[turns.length - 1];
  if (!last || last.role !== 'user') {
    throw new LlmError('Claude Code prompt must end with a user message');
  }
  const earlier = turns.slice(0, -1);
  if (earlier.length === 0) return { system, prompt: last.content };

  const transcript = earlier
    .map((m) => `<${m.role}_turn>\n${m.content}\n</${m.role}_turn>`)
    .join('\n');
  return {
    system,
    prompt: `<conversation_so_far>\n${transcript}\n</conversation_so_far>\n\n${last.content}`,
  };
}

interface StreamLine {
  type?: string;
  event?: { type?: string; delta?: { type?: string; text?: string; thinking?: string } };
  is_error?: boolean;
  result?: string;
}

/**
 * Run one completion through the local Claude Code CLI. Tools, MCP servers,
 * hooks, CLAUDE.md and session persistence are all disabled: the CLI is used as
 * a plain model endpoint. Text and thinking deltas are forwarded to `onDelta`
 * as they stream in, so the UI can show the generation live.
 */
export async function claudeCodeCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  onDelta?: LlmDeltaHandler,
): Promise<string> {
  // The model name comes from the request: only accept plain model ids/aliases.
  if (!/^[A-Za-z0-9][A-Za-z0-9._:[\]-]*$/.test(config.model)) {
    throw new LlmError(`Invalid Claude model name "${config.model}"`);
  }
  const { system, prompt } = toCliPrompt(messages);
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--model',
    config.model,
    '--system-prompt',
    system,
    '--tools',
    '',
    '--safe-mode',
    '--strict-mcp-config',
    '--no-session-persistence',
  ];

  return new Promise<string>((resolve, reject) => {
    const child = spawn(config.baseUrl, args, {
      cwd: tmpdir(),
      env: childEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';
    let stderr = '';
    let result: StreamLine | null = null;
    let settled = false;

    const finish = (err: Error | null, value?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value as string);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(new LlmError(`Claude Code did not answer within ${Math.round(timeoutMs() / 1000)}s`));
    }, timeoutMs());

    const handleLine = (line: string) => {
      if (!line.trim()) return;
      let msg: StreamLine;
      try {
        msg = JSON.parse(line) as StreamLine;
      } catch {
        return;
      }
      if (msg.type === 'result') {
        result = msg;
        return;
      }
      const delta = msg.type === 'stream_event' ? msg.event?.delta : undefined;
      if (!delta || !onDelta) return;
      if (delta.type === 'text_delta' && delta.text) onDelta({ kind: 'text', text: delta.text });
      if (delta.type === 'thinking_delta' && delta.thinking) {
        onDelta({ kind: 'thinking', text: delta.thinking });
      }
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        handleLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      finish(
        new LlmError(
          err.code === 'ENOENT'
            ? `Claude Code CLI not found ("${config.baseUrl}"). Install it and run \`claude\` once to log in, or set CLAUDE_CODE_BIN.`
            : `Could not start Claude Code: ${err.message}`,
        ),
      );
    });

    child.on('close', (code) => {
      handleLine(buffer);
      const final = result as StreamLine | null;
      if (final && !final.is_error && typeof final.result === 'string' && final.result.trim()) {
        finish(null, final.result);
        return;
      }
      const reason =
        (final?.is_error && final.result) ||
        stderr.trim().slice(0, 500) ||
        `exited with code ${code} without a result`;
      finish(new LlmError(`Claude Code failed: ${reason}`));
    });

    child.stdin.end(prompt);
  });
}
